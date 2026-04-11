import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Dumbbell, Layers, Hash, History } from 'lucide-react';

const MENU = {
    PRESETS: {
        "胸": ["ベンチプレス", "インクラインダンベルプレス", "ケーブルフライ"],
        "背中": ["デッドリフト", "ラットプルダウン", "ベントオーバーロウ"],
        "脚": ["スクワット", "レッグプレス", "カーフレイズ"],
        "肩": ["オーバーヘッドプレス", "サイドレイズ", "フェイスプル"],
        "腕": ["バーベルカール", "トライセプスエクステンション", "ハンマーカール"]
    }
};

export default function WorkoutForm({ onUpdate, workouts = [], onTriggerAi }) {
    const [activePart, setActivePart] = useState('胸');
    const [exercise, setExercise] = useState(MENU.PRESETS['胸'][0]);
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');

    // Refs to prevent AI spam
    const lastAiTriggerEx = useRef(null);

    // --- Logic: Full Previous Session ---
    const previousSessionLogs = useMemo(() => {
        if (!workouts || workouts.length === 0) return [];

        // Filter by exercise
        const history = workouts.filter(w => w.exercise === exercise).sort((a, b) => b.timestamp - a.timestamp);
        if (history.length === 0) return [];

        // Get date of the most recent log
        const lastDateString = new Date(history[0].timestamp).toDateString(); // "Fri Jan 01 2026"

        // Filter all logs that match this date
        return history.filter(w => new Date(w.timestamp).toDateString() === lastDateString).reverse(); // Oldest set to Newest set
    }, [exercise, workouts]);

    const lastSet = previousSessionLogs.length > 0 ? previousSessionLogs[previousSessionLogs.length - 1] : null;

    // --- AI Trigger Effect ---
    useEffect(() => {
        // Only trigger if exercise changed AND we have data AND we haven't triggered for this yet
        if (lastSet && exercise !== lastAiTriggerEx.current) {
            // Trigger AI
            onTriggerAi(`ベンチプレスだな！ 前回は${lastSet.weight}kgだった。今日は${Math.round(lastSet.weight + 2.5)}kgに挑戦してみるかい？`);
            lastAiTriggerEx.current = exercise;
        }
    }, [exercise, lastSet, onTriggerAi]);


    useEffect(() => {
        onUpdate({ part: activePart, exercise, weight, reps });
    }, [activePart, exercise, weight, reps, onUpdate]);

    return (
        <div className="w-full space-y-6">
            {/* Body Part Tabs */}
            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar mask-fade-right">
                {Object.keys(MENU.PRESETS).map((part) => (
                    <button
                        key={part}
                        onClick={() => { setActivePart(part); setExercise(MENU.PRESETS[part][0]); }}
                        className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold tracking-wide whitespace-nowrap transition-all",
                            activePart === part
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                        )}
                    >
                        {part}
                    </button>
                ))}
            </div>

            {/* Exercise Select & Recent History */}
            <div className="space-y-2">
                <div className="glass-card">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <Dumbbell size={14} /> 種目を選択
                    </label>
                    <div className="relative">
                        <select
                            value={exercise}
                            onChange={(e) => setExercise(e.target.value)}
                            className="w-full bg-black/50 text-white border border-white/10 rounded-xl p-3 appearance-none outline-none focus:border-blue-500 transition-colors"
                        >
                            {MENU.PRESETS[activePart].map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▾</div>
                    </div>
                </div>

                {/* Smart History Display (Full Log) */}
                {previousSessionLogs.length > 0 && (
                    <div className="glass p-3 rounded-xl space-y-2 border border-blue-500/20 bg-blue-900/10 animate-fade-in">
                        <div className="flex items-center gap-2 text-xs text-cyan-400 font-bold uppercase tracking-wider">
                            <History size={12} />
                            前回の記録 ({new Date(previousSessionLogs[0].timestamp).toLocaleDateString("ja-JP")})
                        </div>
                        <div className="space-y-1">
                            {previousSessionLogs.map((log, index) => (
                                <div key={log.id} className="flex justify-between text-xs text-gray-300 border-b border-white/5 pb-1 last:border-0">
                                    <span className="opacity-50">セット {index + 1}</span>
                                    <span>
                                        <span className="font-bold text-white">{log.weight}kg</span> x {log.reps} Reps
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Weight & Reps Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <Layers size={14} /> 重量 (kg)
                    </label>
                    <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder={lastSet ? lastSet.weight : "60"}
                        className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-700 outline-none"
                    />
                </div>
                <div className="glass-card">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <Hash size={14} /> 回数 (Reps)
                    </label>
                    <input
                        type="number"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder={lastSet ? lastSet.reps : "10"}
                        className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-700 outline-none"
                    />
                </div>
            </div>
        </div>
    );
}
