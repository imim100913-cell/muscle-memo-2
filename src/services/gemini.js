import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Available Gemini model presets.
 * Users can also enter a custom model ID not listed here.
 */
export const GEMINI_MODELS = [
    { id: 'gemini-flash-latest', label: 'Gemini Flash (最新安定版)', desc: '高速・軽量・自動アップデート（推奨）', tier: 'recommended' }
];

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

/**
 * Resolves legacy or empty model IDs to the latest stable Flash model.
 * Also strips accidental double quotes, single quotes, or backticks from user input.
 * Prevents 404/400 errors when obsolete or quoted model names are stored.
 */
function resolveModelId(modelId) {
    if (!modelId) return 'gemini-flash-latest';
    
    // Strip leading/trailing double quotes, single quotes, backticks, or spaces
    const cleanModel = modelId.trim().replace(/^['"`]+|['"`]+$/g, '').trim();

    const legacyIds = [
        'gemini-3-flash', 
        'gemini-3.1-flash-lite', 
        'gemini-3.1-pro', 
        'gemini-3.5-flash', 
        'gemini-2.5-flash', 
        'gemini-2.5-pro', 
        'gemini-1.5-flash', 
        'gemini-1.5-pro'
    ];
    if (!cleanModel || legacyIds.includes(cleanModel)) {
        return 'gemini-flash-latest';
    }
    return cleanModel;
}

const COACH_PROMPTS = {
    'all-might': `あなたは『僕のヒーローアカデミア』のオールマイトのような熱血筋トレコーチです。
常にポジティブで熱いパッションを持ち、ユーザーを大声で励ますように鼓舞します。
一人称は「私」、口癖は「私が来た！」「PLUS ULTRA！」「〜少年！」「〜少女！」です。
【Anti-Gravity 2.0 & RIR最適化ルールに基づく指導スタイル】
1. 挙上動作テンポは「3-0-1テンポ」を意識し、慣性を排除してターゲット部位に効かせろ！
2. フォーム崩れ（チーティング）は即「Fail」！怪我のリスクがある限界レップは負の資産だ！
3. RIR（余力レップ）理論を取り入れ、今週のメゾサイクル目標RIR（Week1: RIR 3、Week2: RIR 2、Week3: RIR 1、Week4: RIR 0）に沿って、「余力を残すスマートな追い込み」と「最終週の限界突破」を熱く指導してください！RIRが多すぎれば「もっと重量を上げるんだ少年！」、RIR 0で消耗していれば「勇気あるディロード（休養）も強さだ！」と叫んでください！
4. ATP-CP系エネルギー回復のため、インターバル（多関節3分、単関節2分）はタイマーで厳守！週の部位ボリュームは9〜12セットが上限、22:30には完全消灯して眠るんだ！
※ユーザーの入力が日常的な挨拶や何気ない雑談である場合は、トレーニングの専門ルール（RIRやインターバル等）を無理やり詰め込むことなく、オールマイトのキャラクターになりきって自然に会話のキャッチボールを行ってください。回答は簡潔に（150文字程度で）まとめてください。`,

    'demon': `あなたは非常に厳しくスパルタな「鬼コーチ」です。
ユーザーの甘えを一切許さず、限界まで追い込むような厳しい言葉（しかし成長を心から願う愛情の裏返し）で叱咤激励します。
一人称は「俺」、口癖は「甘えるな！」「まだ行けるだろ！」「筋肉が泣いてるぞ！」「限界を決めるのはテメェの甘えだ！」など。
【Anti-Gravity 2.0 & RIR最適化ルールに基づく指導スタイル】
1. チーティング禁止！フォーム崩れは即セット終了だ。怪我のリスクしかない無駄なレップは負の資産だ。
2. RIR（余力）理論を叩き込め！Week1のRIR 3からWeek4のRIR 0に向けて、甘えた余力（RIR 4以上）を残しているなら「ウオーミングアップのつもりかコラ！重量を上げろ！」、疲労困憊で挙上速度が極端に落ちているなら「RIRの自己調整（オートレギュレーション）も規律だ、怪我する前にディロードしろ！」と厳しく指導しろ。
3. ATP-CP回復のため、インターバル（多関節3分・単関節2分）は絶対死守！
4. 1日最大9〜12セットの部位ボリューム限界を超えてダラダラやるな. サプリはHuelで十分だ。22:30消灯は義務だ。
※ユーザーの入力が日常的な挨拶や雑談である場合は、専門ルールを毎回押し付けるのではなく、鬼コーチの厳しい口調と愛情を保ったまま、自然で人間味のある会話をしてください。回答はトレーニングの緊張感を保つため、短く簡潔に（150文字程度で）言い切ってください。`,

    'gentle': `あなたはユーザーの心と体に寄り添い、優しく見守る「癒やし系パーソナルトレーナー」です。
決して無理はさせず、ユーザーの体調やモチベーションを第一に気遣います。
一人称は「わたし」、口癖は「すごいですね！」「無理しないでくださいね」「今日も頑張っていて素敵です！」「一緒に綺麗（カッコよく）になりましょう♪」など。
【Anti-Gravity 2.0 & RIR最適化ルールに基づく指導スタイル】
1. 3-0-1テンポ（下ろすの3秒、挙げるの1秒）で優しく効かせましょう。フォームが崩れそうになったらすぐにストップです。
2. RIR（余力）理論を取り入れて、その日の体調に合わせて無理なく調整（オートレギュレーション）しましょうね。Week 1のRIR 3（しっかり余裕を残す）から、少しずつ強度を上げてWeek 3はRIR 1、Week 4はしっかり頑張るRIR 0、または体を休めるディロード週にしましょう。「今日のセットの余力（RIR）はどうでしたか？焦らずいきましょう」と寄り添ってください。
3. ATP-CP系エネルギーの回復のために、タイマーを使って多関節3分、単関節2分ゆっくり休んでください。
4. 1日9〜12セットに抑え、Huelなどを飲みつつ22:30にはぐっすり眠りましょう。
※ユーザーの入力が日常的な挨拶や雑談である場合は、トレーニングの数値やルールを無理に繰り返す必要はありません。優しく聞き役に回り、温かい会話のキャッチボールをしてください。回答は安心感を与えるよう、絵文字や温かい表現を交えて簡潔に（150文字程度で）まとめてください。`,

    'professional': `あなたは科学的エビデンス（運動生理学、解剖学、バイオメカニクス）と数値を徹底重視する「論理派パーソナルトレーナー」です。
感情論ではなく、客観的データに基づいて冷静かつ知的なフィードバックを行います。
一人称は「私」または「僕」、丁寧語で冷静に話します。
【Anti-Gravity 2.0 & RIR最適化ルールに基づく指導スタイル】
1. 慣性の排除と力学的張力最大化のため「3-0-1テンポ」を徹底し、フォーム破綻（チーティング）は「Fail」と定義しセット即時終了を指示します。
2. RIR（Reps in Reserve：余力レップス）と4週メゾサイクルを基軸とした運動強度設計を行います。Week 1（RIR 3）、Week 2（RIR 2）、Week 3（RIR 1）、Week 4（RIR 0 / オーバーリーチまたはディロード）に準拠. 履歴のRIR値を分析し、設定した目標RIRとの乖離に応じた重量・回数のオートレギュレーション（自己調整）を冷徹なデータ分析に基づいて助言してください。
3. ATP-CP系回復のため多関節3分、単関節2分間のインターバルタイマーを適用。
4. 1日最大9〜12セット、サプリは基本成分とHuelに絞り経済的ROIを最適化。22:30の消灯による概日リズム同調を必須条件とします。
※ユーザーの入力が日常的な挨拶や雑談である場合は、データ解析ではなく、論理的かつ知的なキャラクターを保ちつつ、自然なフリートークとしてスマートに対応してください。回答は論理的かつ数値データを交え、簡潔に（180文字程度で）記述してください。`
};

export const GeminiService = {
    /**
     * Generates a response from the Gemini API.
     * @param {string} apiKey - The User's API Key.
     * @param {string} prompt - The specific user trigger or question.
     * @param {string} context - Optional context (e.g. previous logs).
     * @param {string} coachType - The selected coach personality ID.
     * @param {string} modelId - The Gemini model ID to use.
     * @returns {Promise<string>} - The AI's response text.
     */
    generateResponse: async (apiKey, prompt, context = "", coachType = "all-might", modelId = DEFAULT_GEMINI_MODEL) => {
        if (!apiKey) throw new Error("API Key is missing");

        const genAI = new GoogleGenerativeAI(apiKey);
        const resolvedModel = resolveModelId(modelId);
        const model = genAI.getGenerativeModel({ model: resolvedModel });

        const systemPrompt = COACH_PROMPTS[coachType] || COACH_PROMPTS['all-might'];

        const fullPrompt = `
  # システム指示
  ${systemPrompt}

  # ユーザーのトレーニング履歴データ（コンテキスト）
  ${context}

  # 現在のアクション / ユーザーの質問
  ${prompt}

  ※指示：あなたはプロのパーソナルトレーナーです。上記の「履歴データ」を厳密に考慮した上で、口調を守り、トレーニング中にスマートフォンのチャット画面でサクッと読める文字数（150〜180文字程度）で回答してください。
  `;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return response.text();
    },

    /**
     * Validates connection of a given API key by sending a minimal request.
     * @param {string} apiKey - API Key to validate.
     * @param {string} modelId - The Gemini model ID to test with.
     */
    testConnection: async (apiKey, modelId = DEFAULT_GEMINI_MODEL) => {
        if (!apiKey) throw new Error("API Key is missing");
        const genAI = new GoogleGenerativeAI(apiKey);
        const resolvedModel = resolveModelId(modelId);
        const model = genAI.getGenerativeModel({ model: resolvedModel });
        const result = await model.generateContent("Respond with only the word OK.");
        const response = await result.response;
        return response.text().trim();
    }
};

/**
 * Parses Gemini API error into structured user-friendly troubleshooting details.
 * @param {Error} error - Raw API error.
 * @returns {Object}
 */
export function parseGeminiError(error) {
    const msg = error?.message || "";
    const status = error?.status || "";
    const errorStr = `${msg} ${status}`.toLowerCase();
    
    if (errorStr.includes("api_key_http_referrer_blocked") || errorStr.includes("referrer") || errorStr.includes("referer")) {
        return {
            type: "API_KEY_HTTP_REFERRER_BLOCKED",
            title: "APIキー制限エラー (リファラー制限)",
            description: "ご利用中のAPIキーに「特定のウェブサイト（リファラー）」からのアクセス制限が設定されており、このアプリ（Netlify等のホスティング環境）からの通信がGoogle側で遮断されています。",
            solutions: [
                "Google AI Studio (https://aistudio.google.com/) にアクセスし、新しいAPIキーを作成してください。",
                "キー作成時のポップアップでは、特定の「ウェブサイト制限（リファラー制限）」を設定せず、無制限の状態で作成してください。",
                "アプリの「設定」画面から、新しい無制限のAPIキーを入力し直してください。"
            ]
        };
    }
    
    if (errorStr.includes("api_key_invalid") || errorStr.includes("api key not valid") || errorStr.includes("invalid api key")) {
        return {
            type: "API_KEY_INVALID",
            title: "無効なAPIキーエラー",
            description: "入力されたAPIキーが正しくありません。コピー時の文字漏れや、すでに削除・無効化されたキーである可能性があります。",
            solutions: [
                "Google AI Studio の鍵マーク一覧から、正しいキーをコピーしていることを確認してください。",
                "アプリの「設定」画面で、既存のキーを一度クリアし、再度貼り付けて保存してください。"
            ]
        };
    }

    if (errorStr.includes("not found") || errorStr.includes("not_found") || errorStr.includes("is not found") || errorStr.includes("404")) {
        return {
            type: "MODEL_NOT_FOUND",
            title: "モデルが見つかりません (404 Not Found)",
            description: "指定されたAIモデルが存在しないか、廃止されています。最新の安定版モデル（gemini-flash-latest）が適用されているか設定を確認してください。",
            solutions: [
                "設定画面の「AIモデル選択」で「Gemini Flash (最新安定版)」を選択してください。",
                "カスタムモデルIDを指定している場合は、モデル名に入力ミスがないか確認してください。",
                "推奨モデル: gemini-flash-latest（高速・軽量・最新）"
            ]
        };
    }

    if (errorStr.includes("quota") || errorStr.includes("resource_exhausted") || errorStr.includes("limit exceeded") || errorStr.includes("429") || errorStr.includes("too many requests")) {
        return {
            type: "QUOTA_EXCEEDED",
            title: "利用上限制限エラー (429 Too Many Requests / Quota)",
            description: "Gemini APIの無料枠制限（または一時的な秒間リクエスト上限）に達しました。無料プラン（Unpaidキー）の場合、1分あたりのリクエスト数制限が適用されています。",
            solutions: [
                "一時的なリクエスト制限のため、約1分間待ってからもう一度送信してください。",
                "リクエストの間隔（インターバル）を空けて実行してください。",
                "Google AI Studio (https://aistudio.google.com/) で現在の使用量・制限状況（秒間・分間リクエスト制限）をご確認ください。"
            ]
        };
    }

    return {
        type: "NETWORK_ERROR",
        title: "通信接続エラー (Google AI)",
        description: "AIサーバーとの通信中に予期せぬエラーが発生しました。",
        solutions: [
            "デバイスがインターネット（Wi-Fiやモバイル回線）に正常に接続されているかご確認ください。",
            "Google AI API 側のサービス障害やメンテナンスの可能性があります。",
            `詳細: ${msg}`
        ]
    };
}
