

import { User, Trash2, AlertTriangle, Download, FileText, Key } from 'lucide-react';

export default function SettingsView({ userName, setUserName, apiKey, setApiKey, onClearData, workouts, onShowFeedback }) {
    const [nameInput, setNameInput] = useState(userName);
    const [keyInput, setKeyInput] = useState(apiKey || '');

    const handleSave = () => {
        if (!nameInput.trim()) {
            if (onShowFeedback) onShowFeedback("名前を入力してください！");
            else alert("名前を入力してください！");
            return;
        }
        setUserName(nameInput);
        setApiKey(keyInput);
        if (onShowFeedback) onShowFeedback("設定を保存しました！");
        else alert("設定を保存しました！");
    };

    const handleExportCSV = () => {
        if (!workouts || workouts.length === 0) {
            alert("No data to export.");
            return;
        }

        // Generate CSV
        const headers = ["Date", "Exercise", "Weight_kg", "Reps", "Estimated_1RM", "Is_PR"];
        const rows = workouts.map(w => [
            new Date(w.timestamp).toISOString(),
            w.exercise,
            w.weight,
            w.reps,
            w.oneRM,
            w.isPR ? "TRUE" : "FALSE"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `muscle_memo_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 space-y-8 pb-24">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <User className="text-blue-500" /> 設定
            </h2>

            {/* Account Settings Group */}
            <section className="glass p-5 rounded-2xl space-y-6 border border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                    <User size={16} className="text-blue-500" /> アカウント設定
                </h3>

                {/* User Name */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block">ユーザー名（ヒーローネーム）</label>
                    <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full glass p-3 rounded-xl bg-black/30 border-white/10 text-white outline-none focus:border-blue-500 transition-colors"
                        placeholder="名前を入力..."
                    />
                </div>

                {/* API Key */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <label className="text-xs text-yellow-500 font-bold uppercase tracking-wider block flex items-center gap-2">
                            <Key size={12} /> Gemini APIキー設定
                        </label>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 underline opacity-70 hover:opacity-100">
                            キーを取得する
                        </a>
                    </div>
                    <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        className="w-full glass p-3 rounded-xl bg-black/30 border-white/10 text-white outline-none focus:border-yellow-500 transition-colors placeholder:text-gray-700"
                        placeholder="AIzaSy..."
                    />
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                >
                    変更を保存
                </button>
            </section>

            {/* Data Management */}
            <section className="space-y-4 pt-8 border-t border-white/5">
                <label className="text-xs text-blue-400 font-bold uppercase tracking-wider block flex items-center gap-2">
                    <FileText size={12} /> データ管理
                </label>
                <button
                    onClick={handleExportCSV}
                    className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                    <Download size={16} /> CSVデータ出力
                </button>
            </section>

            {/* Danger Zone */}
            <section className="space-y-4 pt-8 border-t border-white/5">
                <label className="text-xs text-red-500 font-bold uppercase tracking-wider block flex items-center gap-2">
                    <AlertTriangle size={12} /> 危険エリア
                </label>

                <div className="glass p-4 rounded-xl border border-red-500/20 bg-red-900/10">
                    <p className="text-xs text-gray-400 mb-4">
                        すべてのデータを完全に削除します。<br />この操作は取り消せません。
                    </p>
                    <button
                        onClick={() => {
                            if (window.confirm("本当に全データを消去しますか？この操作は取り消せません。")) {
                                onClearData();
                            }
                        }}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} /> 全データを消去
                    </button>
                </div>
            </section>
        </div>
    );
}
