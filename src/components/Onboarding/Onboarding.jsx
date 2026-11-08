import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { User, Key, Sparkles, Check, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle2, XCircle, Eye, EyeOff, Activity, Cloud, RefreshCw, LogOut, HelpCircle } from 'lucide-react';
import { GeminiService, parseGeminiError, DEFAULT_GEMINI_MODEL } from '../../services/gemini';

const COACHES_INFO = [
    {
        id: 'all-might',
        name: '熱血コーチ',
        desc: '熱いパッションで限界を超えさせます。',
        avatar: './coach_all_might.png',
        style: 'border-amber-500 text-amber-800 bg-amber-50/40 shadow-sm',
        activeColor: 'ring-2 ring-amber-500 bg-amber-50'
    },
    {
        id: 'demon',
        name: 'スパルタ鬼コーチ',
        desc: '一切の甘えを許さず、厳しい口調で追い込みます。',
        avatar: './coach_demon.png',
        style: 'border-red-500 text-red-800 bg-red-50/40 shadow-sm',
        activeColor: 'ring-2 ring-red-500 bg-red-50'
    },
    {
        id: 'gentle',
        name: '癒やし系コーチ',
        desc: '無理をさせず、優しく寄り添って褒め伸ばします。',
        avatar: './coach_gentle.png',
        style: 'border-green-500 text-green-800 bg-green-50/40 shadow-sm',
        activeColor: 'ring-2 ring-green-500 bg-green-50'
    },
    {
        id: 'professional',
        name: '論理派コーチ',
        desc: '運動科学とバイオメカニクスの数値データを重視します。',
        avatar: './coach_professional.png',
        style: 'border-cyan-600 text-cyan-800 bg-cyan-50/40 shadow-sm',
        activeColor: 'ring-2 ring-cyan-600 bg-cyan-50'
    }
];

const QUESTIONNAIRE = [
    { part: "胸", exercise: "ベンチプレス", defaultWeight: 50, desc: "大胸筋の基本・主要種目" },
    { part: "背中", exercise: "ラットプルダウン", defaultWeight: 40, desc: "背中の広がりを作るラットプル" },
    { part: "肩", exercise: "サイドレイズ", defaultWeight: 8, desc: "肩の丸みを作るサイドレイズ" },
    { part: "脚", exercise: "バーベル・スクワット", defaultWeight: 50, desc: "下半身を網羅するスクワット" },
    { part: "腕", exercise: "バーベル・アームカール", defaultWeight: 20, desc: "力こぶを鍛えるアームカール" }
];

export default function Onboarding({
    onComplete
}) {
    const [step, setStep] = useState(1);
    const [showHelp, setShowHelp] = useState(false);

    // Form inputs
    const [name, setName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [showKeyPassword, setShowKeyPassword] = useState(false);
    const [selectedCoach, setSelectedCoach] = useState('all-might');

    // API Key connection status
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState(null); // { success: boolean, title: string, description: string, solutions?: string[] }

    // Questionnaire answers
    const [historyAnswers, setHistoryAnswers] = useState(
        QUESTIONNAIRE.reduce((acc, cur) => {
            acc[cur.exercise] = { active: false, time: '3months' };
            return acc;
        }, {})
    );

    const handleSkipAll = () => {
        // Apply default configurations immediately
        onComplete({
            userName: 'トレーニー',
            apiKey: '',
            coachType: 'all-might',
            workouts: []
        });
    };

    const handleNext = () => {
        if (step === 1 && !name.trim()) {
            alert("ユーザー名を入力してください。");
            return;
        }
        setStep(prev => prev + 1);
    };

    const handlePrev = () => {
        setStep(prev => prev - 1);
    };

    const handleTestConnection = async () => {
        if (!apiKey.trim()) {
            setTestStatus({
                success: false,
                title: "キーが空欄です",
                description: "接続テストをするには、Gemini APIキーを入力してください。"
            });
            return;
        }
        setIsTesting(true);
        setTestStatus(null);
        try {
            await GeminiService.testConnection(apiKey.trim(), DEFAULT_GEMINI_MODEL);
            setTestStatus({
                success: true,
                title: "疎通テストに成功！",
                description: "Gemini API との正常な通信が確認されました。"
            });
        } catch (error) {
            const parsed = parseGeminiError(error);
            setTestStatus({
                success: false,
                title: parsed.title,
                description: parsed.description,
                solutions: parsed.solutions
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleToggleAnswer = (ex) => {
        setHistoryAnswers(prev => ({
            ...prev,
            [ex]: { ...prev[ex], active: !prev[ex].active }
        }));
    };

    const handleTimeChange = (ex, val) => {
        setHistoryAnswers(prev => ({
            ...prev,
            [ex]: { ...prev[ex], time: val }
        }));
    };

    const handleFinish = () => {
        onComplete({
            userName: name.trim() || 'トレーニー',
            apiKey: apiKey.trim(),
            coachType: selectedCoach,
            workouts: [],
            exercisePreferences: QUESTIONNAIRE.filter(q => historyAnswers[q.exercise]?.active).map(q => ({ part: q.part, name: q.exercise }))
        });
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-200/40 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-200/30 blur-3xl rounded-full pointer-events-none" />

            <div className="w-full max-w-[480px] space-y-6 relative z-10">
                {/* Skip Button Top Right */}
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">Setup Wizard</span>
                    <button
                        onClick={handleSkipAll}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-bold active:scale-95 transition-all outline-none"
                    >
                        スキップしてデフォルトで開始 ➜
                    </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex">
                    {[1, 2, 3, 4].map(s => (
                        <div
                            key={s}
                            className={cn(
                                "flex-1 h-full transition-all duration-300",
                                step >= s ? "bg-gradient-to-r from-blue-600 to-purple-600" : "bg-transparent border-r border-slate-300"
                            )}
                        />
                    ))}
                </div>

                {/* Core Onboarding Steps */}
                <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-md space-y-6">

                    {/* ====================================
                        STEP 1: Welcome & Profile
                        ==================================== */}
                    {step === 1 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="space-y-2 text-center">
                                <h2 className="text-xl font-black text-slate-800">初期セットアップへようこそ</h2>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                    あなたのトレーニング最適化エンジン「Anti-Gravity 2.0」を準備します。簡単な質問に答えるだけで、パーソナライズされた設定で開始できます。
                                </p>
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs text-slate-500 font-bold block flex items-center gap-1.5">
                                    <User size={13} className="text-blue-600" /> ユーザー名（お名前）
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="例: たろう、けい"
                                    className="w-full bg-white p-3 rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-blue-500 transition-colors font-bold text-sm shadow-sm"
                                    autoFocus
                                />
                                <span className="text-[10px] text-slate-500 block leading-normal font-medium">
                                    ※ AIコーチがメッセージの宛名として使用します。ニックネームで構いません。
                                </span>
                            </div>


                        </div>
                    )}

                    {/* ====================================
                        STEP 2: API Key Configuration
                        ==================================== */}
                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="space-y-1.5">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Key className="text-amber-500" size={16} /> Gemini APIキー設定
                                </h3>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                    Google AI のAPIキーを設定します。キーを登録することで、AIコーチがあなたの進捗を細部まで分析し、詳細なフォーム指導や安全アドバイスを提供します。
                                </p>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                    ※ APIキーを登録しなくても、過負荷計算やタイマー連携などの主要な記録機能はローカルの簡易AIモードでそのままご利用いただけます。
                                </span>
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between items-end">
                                    <label className="text-[10px] text-slate-500 font-extrabold block">Gemini APIキー</label>
                                    <div className="flex gap-2 items-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowHelp(!showHelp)}
                                            className={cn(
                                                "text-[10px] px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 font-bold outline-none",
                                                showHelp 
                                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                            )}
                                        >
                                            <HelpCircle size={10} /> APIとは？
                                        </button>
                                        <a
                                            href="https://aistudio.google.com/app/apikey"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] text-blue-600 hover:text-blue-700 underline font-bold"
                                        >
                                            無料キーを取得 ➜
                                        </a>
                                    </div>
                                </div>

                                {/* API Help Card for Beginners */}
                                {showHelp && (
                                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 text-xs space-y-3 animate-fade-in text-slate-700 font-medium">
                                        <div className="font-bold text-amber-800 flex items-center gap-1 text-xs border-b border-amber-200 pb-1.5">
                                            💡 超初心者向け：APIキーかんたん解説
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="font-bold text-amber-700 block">1. APIってなに？</span>
                                                <p className="leading-relaxed text-[11px] text-slate-600">
                                                    異なるアプリを繋ぐ「連絡係（ウェイター）」です。あなたのスマホからGoogleの高性能AI（Gemini）に質問を届け、アドバイスを持ち帰る役割をします。
                                                </p>
                                            </div>
                                            <div>
                                                <span className="font-bold text-amber-700 block">2. お金はかかる？</span>
                                                <p className="leading-relaxed text-[11px] text-slate-600 font-bold text-green-700">
                                                    【完全無料】で使い続けられます。
                                                </p>
                                                <p className="leading-relaxed text-[11px] text-slate-600">
                                                    クレジットカードを登録しない限り、勝手に請求されたり有料プランになることは絶対にありません。無料制限枠（1分間に15回まで）の範囲で安全に使えます。
                                                </p>
                                            </div>
                                            <div>
                                                <span className="font-bold text-amber-700 block">3. 安全性は大丈夫？</span>
                                                <p className="leading-relaxed text-[11px] text-slate-600">
                                                    入力されたキーは、**あなたのスマホ（ブラウザ）の中にのみ安全に保存**されます。アプリ開発者や外部のサーバーに送信されることはありません。
                                                </p>
                                            </div>
                                            <div>
                                                <span className="font-bold text-amber-700 block">4. かんたんな設定の流れ</span>
                                                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600">
                                                    <li>「無料キーを取得」リンクからGoogleアカウントでログイン</li>
                                                    <li>「Create API key」を押し、コピーする</li>
                                                    <li>この画面に貼り付けて「接続テスト」を実行する</li>
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="relative">
                                    <input
                                        type={showKeyPassword ? "text" : "password"}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full bg-white p-3 pr-12 rounded-xl border border-slate-200 text-slate-800 outline-none focus:border-blue-500 transition-colors font-mono text-xs placeholder:text-slate-400 shadow-sm"
                                        placeholder="AIzaSy... (スキップする場合は空欄のまま次へ)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKeyPassword(!showKeyPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 outline-none"
                                    >
                                        {showKeyPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            {/* Connection testing */}
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={isTesting || !apiKey.trim()}
                                className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-white border border-amber-600/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm outline-none"
                            >
                                {isTesting ? "接続テストを実行中..." : "接続テストを実行"}
                            </button>

                            {testStatus && (
                                <div className={cn(
                                    "p-3 rounded-xl border text-[11px] space-y-1.5 animate-fade-in",
                                    testStatus.success 
                                        ? "border-green-200 bg-green-50 text-green-800" 
                                        : "border-red-200 bg-red-50 text-red-800"
                                )}>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {testStatus.success ? <CheckCircle2 size={12} className="text-green-600" /> : <XCircle size={12} className="text-red-600" />}
                                        <span>{testStatus.title}</span>
                                    </div>
                                    <p className="opacity-90 leading-normal font-medium">{testStatus.description}</p>
                                    {testStatus.solutions && (
                                        <div className="border-t border-slate-200/50 pt-1.5 mt-1.5 space-y-1">
                                            <span className="font-bold text-slate-800 block text-[9px]">解決策:</span>
                                            <ul className="list-disc list-inside space-y-0.5 text-slate-500 font-medium">
                                                {testStatus.solutions.map((sol, idx) => (
                                                    <li key={idx}>{sol}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ====================================
                        STEP 3: AI Coach Selection
                        ==================================== */}
                    {step === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="space-y-1 text-center">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center justify-center gap-2">
                                    <Sparkles className="text-amber-500" size={16} /> AIトレーナー選択
                                </h3>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    トレーニングに対するあなたの姿勢や性格に合わせて、専属コーチを選択してください。
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                                {COACHES_INFO.map(coach => {
                                    const isSel = selectedCoach === coach.id;
                                    return (
                                        <div
                                            key={coach.id}
                                            onClick={() => setSelectedCoach(coach.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer transition-all hover:bg-slate-50",
                                                isSel ? coach.style : "bg-slate-50/50"
                                            )}
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-neutral-100 flex-shrink-0">
                                                <img src={coach.avatar} alt={coach.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-extrabold text-slate-800 leading-none">{coach.name}</span>
                                                    {isSel && <Check size={12} className={coach.style} />}
                                                </div>
                                                <p className="text-[10px] text-slate-500 truncate mt-0.5">{coach.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ====================================
                        STEP 4: Initial Menu Questionnaire
                        ==================================== */}
                    {step === 4 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Activity className="text-blue-600" size={16} /> 部位別トレーニング履歴質問
                                </h3>
                                <p className="text-[11px] text-slate-500 leading-normal font-medium">
                                    過去に行ったことのある主要種目にチェックを入れてください。初期重量・目標設定の参考に使います。
                                </p>
                            </div>

                            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                                {QUESTIONNAIRE.map((q) => {
                                    const ans = historyAnswers[q.exercise];
                                    return (
                                        <div 
                                            key={q.exercise} 
                                            className={cn(
                                                "p-3 rounded-xl border transition-all space-y-2 bg-slate-50/50",
                                                ans.active ? "border-blue-200 bg-blue-50/30" : "border-slate-200"
                                            )}
                                        >
                                            <label className="flex items-start gap-2.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={ans.active}
                                                    onChange={() => handleToggleAnswer(q.exercise)}
                                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-transparent"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-800 leading-none">{q.exercise}</span>
                                                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded leading-none font-bold">{q.part}</span>
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">{q.desc}</span>
                                                </div>
                                            </label>

                                            {ans.active && (
                                                <div className="pl-6 pt-1 flex items-center justify-between gap-2 border-t border-slate-200">
                                                    <span className="text-[9px] text-slate-500 font-medium">直近の実施時期は？</span>
                                                    <select
                                                        value={ans.time}
                                                        onChange={(e) => handleTimeChange(q.exercise, e.target.value)}
                                                        className="bg-white text-[10px] text-slate-800 border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-500"
                                                    >
                                                        <option value="3months">最近 (3ヶ月以内)</option>
                                                        <option value="longAgo">過去 (3ヶ月以上前)</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step Navigation Button Footer */}
                    <div className="flex gap-3 pt-2 border-t border-slate-200">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 border border-slate-200 outline-none"
                            >
                                <ChevronLeft size={14} />
                                戻る
                            </button>
                        )}

                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shadow shadow-blue-500/10 outline-none"
                            >
                                次へ
                                <ChevronRight size={14} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleFinish}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow shadow-blue-500/15 outline-none"
                            >
                                設定完了して開始！
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer Defaults Skip Button */}
                {step < 4 && (
                    <div className="text-center">
                        <button
                            onClick={handleSkipAll}
                            className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors uppercase font-bold tracking-widest block mx-auto outline-none"
                        >
                            細かい設定は後回し（スキップして開始）
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
