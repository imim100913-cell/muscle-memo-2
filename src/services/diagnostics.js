import { GeminiService, DEFAULT_GEMINI_MODEL } from './gemini';
import { getLocalDateKey } from '../lib/utils';

/**
 * Run system diagnostics to test Network, Gemini API status,
 * browser capabilities, and localStorage stats.
 * 
 * @param {string} geminiApiKey - User's Gemini API Key
 * @returns {Promise<Object>} Diagnostic results and markdown report
 */
export async function runSystemDiagnostics(geminiApiKey) {
    const results = {
        timestamp: new Date().toISOString(),
        origin: window.location.origin,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        localStorage: false,
        geminiApi: {
            configured: !!geminiApiKey,
            validFormat: false,
            status: 'untested',
            message: '',
            errorCode: '',
            rawMessage: ''
        },
        browserCapabilities: {
            cookieEnabled: navigator.cookieEnabled,
            audioContext: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined',
            cryptoApi: !!(window.crypto && window.crypto.subtle),
            notifications: 'Notification' in window,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio
        },
        networkInfo: null,
        localStorageStats: {
            totalKeys: localStorage.length,
            keysPresent: [],
            workoutsDataSizeChars: 0,
            totalHorizontalRecords: 0,
            totalFlatSets: 0,
            customExercisesCount: {}
        },
        databaseIntegrity: {
            anomalies: [],
            partBreakdown: { "胸": 0, "背中": 0, "肩": 0, "脚": 0, "腕": 0 }
        },
        errors: [],
        suggestions: []
    };

    // 1. LocalStorage Check
    try {
        localStorage.setItem('__diag_test__', '1');
        localStorage.removeItem('__diag_test__');
        results.localStorage = true;
    } catch {
        results.localStorage = false;
        results.errors.push('LocalStorage is unavailable');
        results.suggestions.push('ブラウザのプライベートモード設定やセキュリティ設定により、ローカル保存(LocalStorage)がブロックされている可能性があります。ブラウザの設定を見直してください。');
    }

    // 2. Gemini API Check
    if (geminiApiKey) {
        const trimmedKey = geminiApiKey.trim();
        results.geminiApi.valueMasked = trimmedKey.length > 8 
            ? `${trimmedKey.slice(0, 4)}...${trimmedKey.slice(-4)}`
            : 'Too short';
        
        if (trimmedKey.startsWith('AIzaSy')) {
            results.geminiApi.validFormat = true;
        } else {
            results.geminiApi.validFormat = false;
            results.errors.push('Invalid Gemini API Key prefix');
            results.suggestions.push('Gemini APIキーは通常「AIzaSy」で始まります。正しいAPIキーがコピーされているか確認してください。');
        }

        // Run connection test
        try {
            results.geminiApi.status = 'testing';
            let userModel = DEFAULT_GEMINI_MODEL;
            try {
                const storedModel = localStorage.getItem('muscle-memo-gemini-model');
                if (storedModel) {
                    userModel = JSON.parse(storedModel);
                }
            } catch {
                const storedModel = localStorage.getItem('muscle-memo-gemini-model');
                if (storedModel) {
                    userModel = storedModel;
                }
            }
            await GeminiService.testConnection(trimmedKey, userModel);
            results.geminiApi.status = 'success';
            results.geminiApi.message = '接続に成功しました。AIコーチング機能は正常に稼働しています。';
        } catch (error) {
            results.geminiApi.status = 'failed';
            const rawMsg = error?.message || '';
            results.geminiApi.rawMessage = rawMsg;

            if (rawMsg.includes('API_KEY_HTTP_REFERRER_BLOCKED') || rawMsg.includes('referrer') || rawMsg.includes('referer')) {
                results.geminiApi.errorCode = 'API_KEY_HTTP_REFERRER_BLOCKED';
                results.geminiApi.message = 'APIキー制限エラー (リファラー制限)';
                results.errors.push('Gemini API: Referrer blocked');
                results.suggestions.push('Google AI Studioで作成されたAPIキーに「ウェブサイト制限（リファラー制限）」が設定されています。Netlify等の外部ドメインからのリクエストが遮断されているため、AI Studio (https://aistudio.google.com/) で制限のかかっていない「無制限（None）」のAPIキーを新しく作成し、再設定してください。');
            } else if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
                results.geminiApi.errorCode = 'API_KEY_INVALID';
                results.geminiApi.message = '無効なAPIキー';
                results.errors.push('Gemini API: Invalid key');
                results.suggestions.push('APIキーが無効です。文字が欠けていないか、別のGoogleアカウントのキーではないかご確認ください。');
            } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota')) {
                results.geminiApi.errorCode = 'QUOTA_EXCEEDED';
                results.geminiApi.message = '利用制限枠の超過（クォータ制限）';
                results.errors.push('Gemini API: Quota exceeded');
                results.suggestions.push('Gemini APIの無料利用枠の制限（1分あたりのリクエスト数など）に達しました。しばらく待ってから再度お試しください。');
            } else {
                results.geminiApi.errorCode = 'UNKNOWN_API_ERROR';
                results.geminiApi.message = `API接続エラー: ${rawMsg}`;
                results.errors.push(`Gemini API: ${rawMsg}`);
                results.suggestions.push(`Gemini APIとの疎通に失敗しました。ネット環境を確認するか、時間をおいてお試しください。(詳細: ${rawMsg})`);
            }
        }
    } else {
        results.geminiApi.status = 'not_configured';
        results.geminiApi.message = 'APIキーが設定されていません。ローカルの簡易AIモードが使用されています。';
        results.suggestions.push('AIコーチによる専門的な指導や履歴に基づくアドバイスを受けるには、設定画面から Gemini APIキー を設定してください。');
    }

    // 3. Network Info Check (if available)
    if (navigator.connection) {
        results.networkInfo = {
            effectiveType: navigator.connection.effectiveType || 'unknown',
            rtt: navigator.connection.rtt || 0,
            downlink: navigator.connection.downlink || 0,
            saveData: !!navigator.connection.saveData
        };
    }

    // 4. LocalStorage Stats & Quota Check
    const targetKeys = [
        'muscle-memo-workouts',
        'muscle-memo-user',
        'muscle-memo-gemini-key',
        'muscle-memo-gemini-model',
        'muscle-memo-coach',
        'muscle-memo-custom-exercises',
        'muscle-memo-sound-mode',
        'muscle-memo-onboarded'
    ];

    targetKeys.forEach(k => {
        const val = localStorage.getItem(k);
        if (val !== null) {
            results.localStorageStats.keysPresent.push(k);
            if (k === 'muscle-memo-workouts') {
                results.localStorageStats.workoutsDataSizeChars = val.length;
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) {
                        const isHorizontal = parsed.some(w => w.set1_weight !== undefined);
                        if (isHorizontal) {
                            results.localStorageStats.totalHorizontalRecords = parsed.length;
                            let setsCount = 0;
                            parsed.forEach(record => {
                                for (let i = 1; i <= 30; i++) {
                                    if (record[`set${i}_weight`] !== undefined && record[`set${i}_weight`] !== null && record[`set${i}_weight`] !== '') {
                                        setsCount++;
                                    }
                                }
                            });
                            results.localStorageStats.totalFlatSets = setsCount;
                        } else {
                            results.localStorageStats.totalFlatSets = parsed.length;
                            const uniqueGroups = new Set(parsed.map(w => {
                                const date = w.date || getLocalDateKey(w.timestamp);
                                return `${date}_${w.exercise}`;
                            }));
                            results.localStorageStats.totalHorizontalRecords = uniqueGroups.size;
                        }
                    }
                } catch {
                    // Ignore malformed JSON in stats check
                }
            }
            if (k === 'muscle-memo-custom-exercises') {
                try {
                    const parsed = JSON.parse(val);
                    Object.keys(parsed).forEach(part => {
                        results.localStorageStats.customExercisesCount[part] = parsed[part]?.length || 0;
                    });
                } catch {
                    // Ignore malformed JSON in custom exercises check
                }
            }
        }
    });

    // 5. Database Integrity Analysis
    try {
        const workoutsVal = localStorage.getItem('muscle-memo-workouts');
        if (workoutsVal) {
            const parsed = JSON.parse(workoutsVal);
            if (Array.isArray(parsed)) {
                parsed.forEach((w, index) => {
                    const identifier = w.exercise || `Index:${index}`;
                    const isHorizontal = w.set1_weight !== undefined;
                    
                    if (isHorizontal) {
                        if (!w.exercise) results.databaseIntegrity.anomalies.push(`セッション #${index}: 種目名(exercise)が欠落しています。`);
                        if (!w.date) results.databaseIntegrity.anomalies.push(`セッション #${index} (${identifier}): 日付(date)が欠落しています。`);
                        if (!w.part) {
                            results.databaseIntegrity.anomalies.push(`セッション #${index} (${identifier}): 部位(part)が欠落しています。`);
                        } else if (results.databaseIntegrity.partBreakdown[w.part] !== undefined) {
                            results.databaseIntegrity.partBreakdown[w.part]++;
                        }
                    } else {
                        // 1 set = 1 record format
                        if (!w.exercise) results.databaseIntegrity.anomalies.push(`レコード #${index}: 種目名(exercise)が欠落しています。`);
                        if (w.weight === undefined || isNaN(parseFloat(w.weight))) results.databaseIntegrity.anomalies.push(`レコード #${index} (${identifier}): 重量(weight)が不正です。`);
                        if (w.reps === undefined || isNaN(parseInt(w.reps, 10))) results.databaseIntegrity.anomalies.push(`レコード #${index} (${identifier}): 回数(reps)が不正です。`);
                        if (w.part && results.databaseIntegrity.partBreakdown[w.part] !== undefined) {
                            results.databaseIntegrity.partBreakdown[w.part]++;
                        }
                    }
                });
            } else {
                results.databaseIntegrity.anomalies.push("データベース構造が配列ではありません。");
            }
        }
    } catch (e) {
        results.databaseIntegrity.anomalies.push(`パースエラー: ${e.message}`);
    }

    if (!navigator.onLine) {
        results.errors.push('Device is offline');
        results.suggestions.unshift('端末がオフラインです。インターネットに接続されていることを確認し、Wi-Fiやモバイル通信状況を改善してください。');
    }

    // Generate Markdown report for copying
    const reportLines = [
        `# Anti-Gravity 2.0 システム診断レポート`,
        `- **生成時刻**: ${new Date(results.timestamp).toLocaleString('ja-JP')} (ISO: ${results.timestamp})`,
        `- **アプリ実行元 (Origin)**: \`${results.origin}\``,
        `- **接続状態**: ${results.online ? '🟢 オンライン' : '🔴 オフライン'}`,
        `- **端末ブラウザ (UserAgent)**: \`${results.userAgent}\``,
        `- **ローカルストレージ (LocalStorage)**: ${results.localStorage ? '🟢 利用可能' : '🔴 利用不可'}`,
        ``,
        `## 1. AI 機能 (Gemini API) 診断`,
        `- **Gemini APIキー**: ${geminiApiKey ? `設定あり (\`${results.geminiApi.valueMasked}\`)` : '⚪ 未設定'}`,
        `  - **形式妥当性**: ${geminiApiKey ? (results.geminiApi.validFormat ? '🟢 正常 (AIzaSyから開始)' : '🔴 不正') : '⚪ N/A'}`,
        `- **接続テストステータス**: ${
            results.geminiApi.status === 'success' ? '🟢 成功' : 
            results.geminiApi.status === 'failed' ? `🔴 失敗 (エラーコード: ${results.geminiApi.errorCode || 'UNKNOWN'})` : 
            results.geminiApi.status === 'not_configured' ? '⚪ 未設定' : '⚪ 未実施'
         }`,
        `- **詳細メッセージ**: ${results.geminiApi.message || 'なし'}`,
        results.geminiApi.rawMessage ? `- **サーバーエラー詳細**: \`${results.geminiApi.rawMessage}\`` : '',
        ``,
        `## 2. アプリ環境・ブラウザ機能 診断`,
        `- **クッキー有効化 (Cookies)**: ${results.browserCapabilities.cookieEnabled ? '🟢 有効' : '🔴 無効'}`,
        `- **Web Audio API (効果音再生)**: ${results.browserCapabilities.audioContext ? '🟢 サポートあり' : '🔴 未サポート'}`,
        `- **Web Crypto API (暗号モジュール)**: ${results.browserCapabilities.cryptoApi ? '🟢 サポートあり' : '🔴 未サポート'}`,
        `- **通知機能 (Notification API)**: ${results.browserCapabilities.notifications ? '🟢 サポートあり' : '⚪ 未サポート'}`,
        `- **ブラウザ言語 (Language)**: \`${results.browserCapabilities.language}\``,
        `- **画面解像度 / ビューポート**: \`${results.browserCapabilities.screenSize}\` / \`${results.browserCapabilities.viewportSize}\` (DPR: ${results.browserCapabilities.devicePixelRatio})`,
        results.networkInfo ? `- **ネットワーク回線状態**: \`${results.networkInfo.effectiveType}\` (RTT: ${results.networkInfo.rtt}ms, 下り推定: ${results.networkInfo.downlink}Mbps)` : '',
        ``,
        `## 3. ローカルデータ・ストレージ使用状況`,
        `- **ローカルストレージ設定済みキー数**: ${results.localStorageStats.totalKeys}個`,
        `- **存在するキー**: ${results.localStorageStats.keysPresent.map(k => `\`${k}\``).join(', ') || 'なし'}`,
        `- **ワークアウト履歴データサイズ**: \`${results.localStorageStats.workoutsDataSizeChars}\` 文字 (約 ${(results.localStorageStats.workoutsDataSizeChars / 1024).toFixed(2)} KB)`,
        `- **保存履歴総件数 (日別の種目数)**: \`${results.localStorageStats.totalHorizontalRecords}\` 件`,
        `- **総セット数 (全日の合計挙上回数)**: \`${results.localStorageStats.totalFlatSets}\` セット`,
        `- **カスタム種目登録数**: ${Object.entries(results.localStorageStats.customExercisesCount).map(([part, count]) => `${part}: ${count}件`).join(', ') || 'なし'}`,
        ``,
        `## 4. データベース整合性・健全性 診断`,
        results.databaseIntegrity.anomalies.length > 0 
            ? `🔴 **${results.databaseIntegrity.anomalies.length}件のデータ整合性異常を検出しました。**\n${results.databaseIntegrity.anomalies.map(a => `  - ${a}`).join('\n')}` 
            : '🟢 データベース整合性は正常です。インデックスや必須フィールドの欠落はありません。',
        `- **部位別セッション割合**: 胸: ${results.databaseIntegrity.partBreakdown["胸"]}件, 背中: ${results.databaseIntegrity.partBreakdown["背中"]}件, 肩: ${results.databaseIntegrity.partBreakdown["肩"]}件, 脚: ${results.databaseIntegrity.partBreakdown["脚"]}件, 腕: ${results.databaseIntegrity.partBreakdown["腕"]}件`,
        ``,
        `## 5. 検出された問題点 & トラブルシューティング手順`,
        results.errors.length > 0 ? `合計 ${results.errors.length} 個のエラーを検出しました。` : '特段のエラーは検出されていません。快適にご利用いただけます！',
        ``,
        ...results.suggestions.map((s, idx) => `${idx + 1}. **${s}**`),
        ``,
        `---`,
        `*このレポートはシステム診断ツールによって自動生成されました。外部AI（ChatGPT, Gemini, Claude等）にコピー＆ペーストして相談することで、さらに具体的な解決方法を得ることができます。*`
    ];

    results.markdownReport = reportLines.filter(line => line !== null && line !== undefined).join('\n');
    return results;
}
