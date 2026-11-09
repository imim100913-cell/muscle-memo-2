import React, { useState } from 'react';
import { 
    User, Trash2, AlertTriangle, Download, FileText, Key, Sparkles, 
    Check, Eye, EyeOff, CheckCircle2, XCircle, Cloud, RefreshCw, 
    LogOut, HelpCircle, Activity, Copy, ShieldAlert, Smartphone, QrCode, Sun 
} from 'lucide-react';
import { cn, getLocalDateKey } from '../../lib/utils';
import { recoverPending } from '../../lib/persistence.js';
import { restoreBackup } from '../../services/mobileSync';
import { migrateToFlatWorkouts } from '../../lib/workoutMigration';
import { GeminiService, parseGeminiError, GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from '../../services/gemini';
import { runSystemDiagnostics } from '../../services/diagnostics';

const COACHES = [
    {
        id: 'all-might',
        name: '熱血コーチ',
        desc: '限界を超えろ！熱いパッションであなたを最高に高めます。',
        avatar: './coach_all_might.png',
        color: 'border-yellow-500/50 shadow-yellow-500/10 text-amber-600',
        activeColor: 'ring-2 ring-yellow-500 bg-yellow-50/85 border-yellow-300'
    },
    {
        id: 'demon',
        name: 'スパルタ鬼コーチ',
        desc: '甘えるな！厳しい言葉であなたの限界をこじ開けます。',
        avatar: './coach_demon.png',
        color: 'border-red-500/50 shadow-red-500/10 text-red-700',
        activeColor: 'ring-2 ring-red-500 bg-red-50/85 border-red-300'
    },
    {
        id: 'gentle',
        name: '癒やし系コーチ',
        desc: '大丈夫ですよ♪ 優しく寄り添い、全力で褒めて伸ばします。',
        avatar: './coach_gentle.png',
        color: 'border-green-500/50 shadow-green-500/10 text-green-700',
        activeColor: 'ring-2 ring-green-500 bg-green-50/85 border-green-300'
    },
    {
        id: 'professional',
        name: '論理派コーチ',
        desc: '数値を信じよ。運動科学に基づき、冷静かつ効果的に指導します。',
        avatar: './coach_professional.png',
        color: 'border-cyan-500/50 shadow-cyan-500/10 text-cyan-700',
        activeColor: 'ring-2 ring-cyan-500 bg-cyan-50/85 border-cyan-300'
    }
];

export default function SettingsView({ 
    userName, 
    setUserName, 
    apiKey, 
    setApiKey, 
    coachType, 
    setCoachType, 
    onClearData, 
    workouts, 
    onShowFeedback, 
    onSaveSettings,
    geminiModel,
    setGeminiModel,
    onOpenMobileSync,
    isWakeLockEnabled,
    onToggleWakeLock,
    onCheckUpdate
}) {
    const [nameInput, setNameInput] = useState(userName);
    const [keyInput, setKeyInput] = useState(apiKey || '');
    const [selectedCoach, setSelectedCoach] = useState(coachType || 'all-might');
    const [selectedModel, setSelectedModel] = useState(geminiModel || DEFAULT_GEMINI_MODEL);
    const [customModelInput, setCustomModelInput] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    // Premium API Key States
    const [isEditingKey, setIsEditingKey] = useState(!apiKey);
    const [showKeyPassword, setShowKeyPassword] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState(null); // { success: boolean, title: string, description: string, solutions?: string[] }

    // System Diagnostics States
    const [diagResults, setDiagResults] = useState(null);
    const [isDiagRunning, setIsDiagRunning] = useState(false);
    const [diagCopied, setDiagCopied] = useState(false);

    const handleSave = () => {
        if (!nameInput.trim()) {
            if (onShowFeedback) onShowFeedback("名前を入力してください！");
            else alert("名前を入力してください！");
            return;
        }
        if (onSaveSettings) {
            const result = onSaveSettings(nameInput, keyInput, selectedCoach, selectedModel);
            if (result?.success === false) return;
        } else {
            setUserName(nameInput);
            setApiKey(keyInput);
            setCoachType(selectedCoach);
            if (setGeminiModel) setGeminiModel(selectedModel);
        }
        if (keyInput) {
            setIsEditingKey(false);
        }
        if (onShowFeedback) onShowFeedback("設定を保存しました！");
    };

    const handleTestConnection = async (keyToTest) => {
        if (!keyToTest || !keyToTest.trim()) {
            setTestStatus({
                success: false,
                title: "キーが入力されていません",
                description: "接続テストを実行するには、APIキーを入力してください。"
            });
            return;
        }

        setIsTesting(true);
        setTestStatus(null);

        try {
            await GeminiService.testConnection(keyToTest.trim(), selectedModel);
            setTestStatus({
                success: true,
                title: "テスト接続に成功！",
                description: "Gemini API との疎通が正常に確認できました。AIコーチング機能が利用可能です。"
            });
        } catch (error) {
            console.error("Test connection failed");
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

    const handleRunDiagnostics = async () => {
        setIsDiagRunning(true);
        setDiagResults(null);
        setDiagCopied(false);
        try {
            const res = await runSystemDiagnostics(keyInput);
            setDiagResults(res);
        } catch (e) {
            console.error("Diagnostics failed");
            alert("診断の実行中にエラーが発生しました: " + e.message);
        } finally {
            setIsDiagRunning(false);
        }
    };

    const handleCopyDiag = () => {
        if (!diagResults) return;
        navigator.clipboard.writeText(diagResults.markdownReport);
        setDiagCopied(true);
        setTimeout(() => setDiagCopied(false), 2000);
    };

    const handleExportBackup = () => {
        try { recoverPending(localStorage); }
        catch { alert("復旧が完了していません。原本を保護するためバックアップ出力を停止しています。"); return; }
        const backupData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('muscle-memo-') && !key.startsWith('muscle-memo-internal-') && key !== 'muscle-memo-gemini-key') {
                const val = localStorage.getItem(key);
                if (val !== null) {
                    backupData[key] = val;
                }
            }
        }

        const payload = {
            application: "Anti-Gravity Workout Tracker",
            version: "2.0",
            exportAt: new Date().toISOString(),
            data: backupData
        };

        const jsonString = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `anti-gravity-backup-${getLocalDateKey()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (onShowFeedback) onShowFeedback("バックアップファイルを書き出しました！");
    };

    const handleImportBackup = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                restoreBackup(parsed);

                alert("設定とデータを非破壊で復元しました。アプリを再読み込みします。");
                window.location.reload();
            } catch (err) {

                alert("バックアップファイルの復元に失敗しました。正しいJSONファイルを選択してください。(詳細: " + (err instanceof SyntaxError ? "JSON形式が不正です" : err.message) + ")");
            }
        };
        reader.readAsText(file);
    };

    const handleExportCSV = () => {
        const flatWorkouts = migrateToFlatWorkouts(workouts);
        if (!flatWorkouts || flatWorkouts.length === 0) {
            if (onShowFeedback) onShowFeedback("出力するデータがありません。");
            else alert("出力するデータがありません。");
            return;
        }

        const headers = [
            "日付",
            "種目",
            "部位",
            "セット番号",
            "重量_kg",
            "回数_Reps",
            "推定1RM_kg",
            "余力_RIR",
            "自由メモ",
            "フォーム品質",
            "インターバル_秒",
            "自己ベスト"
        ];

        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const rows = flatWorkouts.map((w, idx) => {
            const formLabel = w.formScore === 'perfect' ? 'Perfect' : w.formScore === 'good' ? 'Good' : (w.formScore === 'fail' ? 'Fail' : (w.formScore || ''));
            return [
                w.date || getLocalDateKey(w.timestamp),
                w.exercise || "",
                w.part || "",
                w.setNum !== undefined ? w.setNum : (idx + 1),
                w.weight !== undefined ? w.weight : "",
                w.reps !== undefined ? w.reps : "",
                w.oneRM !== undefined ? w.oneRM : "",
                w.rir ?? null,
                w.memo || "",
                formLabel,
                w.interval !== undefined ? w.interval : 120,
                w.isPR ? "★PR" : ""
            ].map(escapeCSV).join(",");
        });

        const csvContent = [
            headers.map(escapeCSV).join(","),
            ...rows
        ].join("\r\n");

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `マッスルメモ_データ出力_${getLocalDateKey()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (onShowFeedback) onShowFeedback("CSVファイルを書き出しました！");
    };

    return (
        <div className="p-4 space-y-8 pb-32">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <User className="text-blue-600" /> 設定
            </h2>

            {/* Smartphone Bridge & PWA Settings Group */}
            <section className="glass p-5 rounded-2xl space-y-4 border border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-200/70 pb-3">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <Smartphone size={16} className="text-blue-600" /> スマホ連携・アプリ化 (PWA 2.0)
                    </h3>
                    <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-extrabold">
                        NEW
                    </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    HTTPSとWeb Locks対応ブラウザで利用してください。設定・履歴はURL・コードまたはJSONバックアップで手動移行できます。この版ではLAN QR接続・自動同期は利用できません。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                        type="button"
                        onClick={onOpenMobileSync}
                        className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
                    >
                        <QrCode size={15} /> スマホへのデータ移行を開く
                    </button>

                    <button
                        type="button"
                        onClick={async () => {
                            if (onCheckUpdate) {
                                const res = await onCheckUpdate();
                                if (onShowFeedback) {
                                    const notices = {
                                        update_found: '新しいバージョンが見つかりました！',
                                        checking: '新しいバージョンを確認中です。準備ができると更新ボタンを表示します。',
                                        up_to_date: 'すでに最新バージョンを使用中です✨',
                                        check_failed: '更新状況を確認できません。接続を確認して再試行してください。',
                                        unavailable: 'この環境では更新状況を確認できません。'
                                    };
                                    onShowFeedback(notices[res] || notices.unavailable);
                                }
                            }
                        }}
                        className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                    >
                        <RefreshCw size={14} className="text-blue-600" /> 最新バージョンを確認
                    </button>
                </div>

                {/* Screen Wake Lock Toggle */}
                <div className="flex items-center justify-between bg-white/90 border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center gap-2.5">
                        <Sun size={16} className={isWakeLockEnabled ? "text-amber-500" : "text-slate-400"} />
                        <div>
                            <div className="text-xs font-bold text-slate-800">トレーニング中の画面スリープ防止 (Wake Lock)</div>
                            <div className="text-[10px] text-slate-500">セッション中・タイマー稼働中にスマホ画面が消えるのを防ぎます</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onToggleWakeLock}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-extrabold transition-all",
                            isWakeLockEnabled
                                ? "bg-amber-500 text-white shadow-sm"
                                : "bg-slate-200 text-slate-600"
                        )}
                    >
                        {isWakeLockEnabled ? "ON (常時点灯)" : "OFF"}
                    </button>
                </div>
            </section>

            {/* Account Settings Group */}
            <section className="glass p-5 rounded-2xl space-y-6 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3">
                    <User size={16} className="text-blue-600" /> アカウント設定
                </h3>

                {/* User Name */}
                <div className="space-y-2">
                    <label className="text-xs text-slate-600 font-bold uppercase tracking-wider block">ユーザー名（トレーニング時の名前）</label>
                    <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all text-sm font-medium shadow-sm"
                        placeholder="名前を入力..."
                    />
                </div>

                {/* API Key Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <label className="text-xs text-amber-600 font-bold uppercase tracking-wider block flex items-center gap-2">
                            <Key size={12} className="text-amber-500" /> Gemini APIキー設定
                        </label>
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
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:text-blue-700 underline font-bold transition-all">
                                キーを取得 (Google AI Studio)
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
                                        <li>「キーを取得」リンクからGoogleアカウントでログイン</li>
                                        <li>「Create API key」を押し、コピーする</li>
                                        <li>この画面に貼り付けて「接続テスト」をして保存</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isEditingKey ? (
                        /* Masked Configured State */
                        <div className="glass p-4 rounded-xl border border-green-200 bg-green-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs font-bold text-green-700 font-sans">接続設定済み</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {apiKey.slice(0, 7)}...{apiKey.slice(-4)}
                                </span>
                            </div>
                            
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleTestConnection(apiKey)}
                                    disabled={isTesting}
                                    className="flex-1 py-2 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200/80 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                                >
                                    {isTesting ? "接続テスト中..." : "接続テストを実行"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditingKey(true);
                                        setTestStatus(null);
                                    }}
                                    className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-bold text-blue-600 transition-all active:scale-95"
                                >
                                    変更
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm("APIキー設定を削除しますか？ (AIコーチング機能はローカルの簡易応答になります)")) {
                                            setKeyInput('');
                                            setApiKey('');
                                            setIsEditingKey(true);
                                            setTestStatus(null);
                                            if (onShowFeedback) onShowFeedback("APIキーを消去しました。");
                                        }
                                    }}
                                    className="px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 transition-all active:scale-95"
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Input Edit State */
                        <div className="space-y-3">
                            <div className="relative">
                                <input
                                    type={showKeyPassword ? "text" : "password"}
                                    value={keyInput}
                                    onChange={(e) => setKeyInput(e.target.value)}
                                    className="w-full p-3 pr-12 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-800 outline-none focus:bg-white focus:border-yellow-500 transition-all placeholder:text-slate-400 font-mono text-sm shadow-sm"
                                    placeholder="AIzaSy... (APIキーを入力)"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKeyPassword(!showKeyPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors p-1"
                                >
                                    {showKeyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleTestConnection(keyInput)}
                                    disabled={isTesting || !keyInput.trim()}
                                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-white border border-amber-600/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 animate-pulse"
                                >
                                    {isTesting ? "接続テスト中..." : "接続テストを実行"}
                                </button>
                                {apiKey && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setKeyInput(apiKey);
                                            setIsEditingKey(false);
                                            setTestStatus(null);
                                        }}
                                        className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs text-slate-600 font-medium transition-all active:scale-95"
                                    >
                                        キャンセル
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Connection Test Result Feedback */}
                    {testStatus && (
                        <div className={cn(
                             "p-4 rounded-xl border text-xs space-y-2 animate-fade-in",
                             testStatus.success 
                                 ? "border-green-200 bg-green-50 text-green-800" 
                                 : "border-red-200 bg-red-50 text-red-800"
                        )}>
                            <div className="flex items-center gap-1.5 font-bold">
                                {testStatus.success ? (
                                    <>
                                        <CheckCircle2 size={14} className="text-green-600" />
                                        <span>{testStatus.title}</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={14} className="text-red-600" />
                                        <span>{testStatus.title}</span>
                                    </>
                                )}
                            </div>
                            <p className="leading-relaxed font-semibold">{testStatus.description}</p>
                            
                            {!testStatus.success && testStatus.solutions && testStatus.solutions.length > 0 && (
                                <div className="pt-1.5 border-t border-red-200/60 mt-1.5 space-y-1">
                                    <div className="font-extrabold text-[10px] uppercase tracking-wider text-red-700">推奨される解決策:</div>
                                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] font-semibold text-slate-700">
                                        {testStatus.solutions.map((sol, idx) => (
                                            <li key={idx} className="leading-relaxed">{sol}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Local Backup & Restore Settings Group */}
            <section className="glass p-5 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Cloud size={16} className="text-blue-600" /> 設定のバックアップと復元
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    設定データやワークアウト履歴をJSONファイルとしてローカルに書き出し、または書き出したファイルから設定を復元することができます。記録は追加方式で復元し、同一IDの競合は停止します。端末の機種変更や別ブラウザへのデータ移行時にご利用ください。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                        onClick={handleExportBackup}
                        className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow animate-pulse"
                    >
                        <Download size={14} /> 設定をエクスポート
                    </button>
                    <label className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm cursor-pointer text-center">
                        <RefreshCw size={14} /> 設定をインポート
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImportBackup}
                            className="hidden"
                        />
                    </label>
                </div>
            </section>

            {/* AI Model Selection Group */}
            <section className="glass p-5 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Activity size={16} className="text-purple-600" /> AIモデル選択
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Gemini APIで使用するモデルを選択してください。モデルによって応答速度・品質・料金が異なります。
                </p>

                <div className="space-y-2">
                    {GEMINI_MODELS.map((m) => {
                        const isActive = selectedModel === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => { setSelectedModel(m.id); setCustomModelInput(''); }}
                                className={cn(
                                    "w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between gap-2",
                                    isActive
                                        ? "bg-purple-50 border-purple-300 ring-1 ring-purple-200 text-purple-800"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                )}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{m.label}</span>
                                        {m.tier === 'recommended' && (
                                            <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-extrabold">推奨</span>
                                        )}
                                        {m.tier === 'legacy' && (
                                            <span className="text-[8px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-extrabold">旧世代</span>
                                        )}
                                        {m.tier === 'premium' && (
                                            <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-extrabold">高性能</span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-500">{m.desc}</span>
                                </div>
                                {isActive && <Check size={14} className="text-purple-600 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Custom Model ID Input */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                        カスタムモデルID（上記にないモデルを使用する場合）
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customModelInput}
                            onChange={(e) => setCustomModelInput(e.target.value)}
                            className="flex-1 p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-800 outline-none focus:bg-white focus:border-purple-500 font-mono text-[11px] shadow-sm"
                            placeholder="例: gemini-3.5-flash-preview"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (customModelInput.trim()) {
                                    setSelectedModel(customModelInput.trim());
                                }
                            }}
                            disabled={!customModelInput.trim()}
                            className="px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex-shrink-0"
                        >
                            適用
                        </button>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                        <Activity size={10} className="text-purple-500" />
                        現在選択中: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-purple-700 font-bold">{selectedModel}</code>
                    </div>
                </div>
            </section>

            {/* AI Coach Selection Group */}
            <section className="glass p-5 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Sparkles size={16} className="text-yellow-600" /> AIトレーナー選択
                </h3>
                <p className="text-[11px] text-slate-600 font-medium">あなたのモチベーションを高める専属コーチを選んでください。</p>

                <div className="grid grid-cols-1 gap-3">
                    {COACHES.map((coach) => {
                        const isActive = selectedCoach === coach.id;
                        return (
                            <div
                                key={coach.id}
                                onClick={() => setSelectedCoach(coach.id)}
                                className={cn(
                                    "flex items-center gap-4 p-3 rounded-xl border border-slate-200 cursor-pointer transition-all hover:bg-slate-100",
                                    isActive ? coach.activeColor : "bg-slate-50"
                                )}
                            >
                                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0">
                                    <img src={coach.avatar} alt={coach.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-800">{coach.name}</span>
                                        {isActive && <Check size={14} className={coach.color} />}
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate font-medium">{coach.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* System Diagnostics Card */}
            <section className="glass p-5 rounded-2xl space-y-5 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Activity size={16} className="text-blue-600 animate-pulse" /> システム診断 &amp; トラブルシューティング
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Google連携やAPIキーが動作しない場合、ここで詳細なテスト接続を実行し、問題点を確認できます。
                </p>

                <button
                    type="button"
                    onClick={handleRunDiagnostics}
                    disabled={isDiagRunning}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow"
                >
                    <RefreshCw size={14} className={isDiagRunning ? "animate-spin" : ""} />
                    {isDiagRunning ? "診断を実行中..." : "接続診断テストを実行する"}
                </button>

                {diagResults && (
                    <div className="space-y-4 animate-fade-in text-xs">
                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-inner">
                            <div className="font-bold text-slate-800 text-[11px] border-b border-slate-200 pb-1.5">テスト結果サマリー</div>
                            <div className="space-y-1.5 font-medium text-slate-700">
                                <div className="flex justify-between items-center">
                                    <span>ネットワーク接続:</span>
                                    <span className="font-bold">{diagResults.online ? "🟢 オンライン" : "🔴 オフライン"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Gemini API (AI接続):</span>
                                    <span className="font-bold">
                                        {diagResults.geminiApi.status === 'success' ? "🟢 正常" : 
                                         diagResults.geminiApi.status === 'failed' ? "🔴 接続失敗" : "⚪ 未設定"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5 mt-1.5">
                                    <span>ブラウザ機能 (Crypto/Audio):</span>
                                    <span className="font-bold font-sans">
                                        {diagResults.browserCapabilities?.cryptoApi && diagResults.browserCapabilities?.audioContext ? "🟢 正常" : "⚠️ 一部未サポート"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>セッション件数 / 総セット数:</span>
                                    <span className="font-bold font-mono">
                                        {diagResults.localStorageStats?.totalHorizontalRecords}件 / {diagResults.localStorageStats?.totalFlatSets}セット
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>ストレージ使用量 (ワークアウト):</span>
                                    <span className="font-bold font-mono">
                                        {diagResults.localStorageStats ? `${(diagResults.localStorageStats.workoutsDataSizeChars / 1024).toFixed(2)} KB` : "0 KB"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>DB整合性ステータス:</span>
                                    <span className={cn("font-bold", diagResults.databaseIntegrity?.anomalies.length > 0 ? "text-red-700" : "text-green-700")}>
                                        {diagResults.databaseIntegrity?.anomalies.length > 0 ? `🔴 異常 (${diagResults.databaseIntegrity.anomalies.length}件)` : "🟢 正常"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Errors & suggestions */}
                        {diagResults.errors.length > 0 ? (
                            <div className="border border-red-200 bg-red-50 text-red-800 p-3.5 rounded-xl space-y-2">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <ShieldAlert size={14} className="text-red-600" />
                                    <span>{diagResults.errors.length}件のエラー/警告が検出されました</span>
                                </div>
                                <ul className="list-decimal list-inside space-y-1 text-[11px] font-semibold text-slate-700">
                                    {diagResults.suggestions.map((s, idx) => (
                                        <li key={idx} className="leading-relaxed">{s}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="border border-green-200 bg-green-50 text-green-800 p-3.5 rounded-xl font-bold flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-green-600" />
                                <span>システムはすべて正常に稼働しています！</span>
                            </div>
                        )}

                        {/* Copy for AI consultation */}
                        <div className="p-3.5 border border-blue-200 bg-blue-50/50 rounded-xl space-y-3">
                            <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                                💡 **【外部AIへの相談機能】**<br />
                                この診断結果をコピーして ChatGPT / Claude / Gemini などのAIに貼り付けることで、より具体的な解決手順をいつでも相談できます。
                            </p>
                            <button
                                type="button"
                                onClick={handleCopyDiag}
                                className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                            >
                                <Copy size={12} />
                                {diagCopied ? "診断レポートをコピーしました！" : "診断レポートをクリップボードにコピー"}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Save Button - Sticky Footer */}
            <div className="sticky bottom-20 z-30 pt-2 pb-1 bg-gradient-to-t from-white via-white/95 to-transparent">
                <button
                    onClick={handleSave}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-white flex items-center justify-center gap-2"
                >
                    設定を保存する
                </button>
            </div>

            {/* Data Management */}
            <section className="space-y-4 pt-8 border-t border-slate-200">
                <label className="text-xs text-blue-600 font-bold uppercase tracking-wider block flex items-center gap-2">
                    <FileText size={12} /> データ管理
                </label>
                <button
                    onClick={handleExportCSV}
                    className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    <Download size={16} /> CSVデータ出力 (Excel対応)
                </button>
            </section>

            {/* Danger Zone */}
            <section className="space-y-4 pt-8 border-t border-slate-200">
                <label className="text-xs text-red-700 font-bold uppercase tracking-wider block flex items-center gap-2">
                    <AlertTriangle size={12} /> 危険エリア
                </label>

                <div className="glass p-4 rounded-xl border border-red-200 bg-red-50/50">
                    <p className="text-xs text-slate-600 mb-4 font-semibold">
                        端末の記録と設定を初期化します。復旧用の原本は保全します。<br />削除同期は未対応のため、初期化後の同期・復元は停止します。
                    </p>
                    <button
                        onClick={() => {
                            if (window.confirm("記録と設定を初期化しますか？復旧用原本は保全します。初期化後は削除情報を確認するまで同期・復元を停止します。")) {
                                const result = onClearData();
                                if (result?.success && onShowFeedback) onShowFeedback("記録と設定を初期化しました。");
                            }
                        }}
                        className="w-full py-3 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white border border-red-200 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} /> 記録と設定を初期化
                    </button>
                </div>
            </section>
        </div>
    );
}
