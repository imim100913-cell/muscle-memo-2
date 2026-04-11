import React from 'react';
import { Trophy, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

import ProgressChart from './ProgressChart';

export default function HistoryView({ workouts }) {
    if (!workouts || workouts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 min-h-[50vh]">
                <Trophy size={48} className="mb-4 opacity-20" />
                <p>まだ記録がありません。<br />トレーニングを始めましょう！</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 pb-24">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Calendar className="text-blue-500" /> トレーニング履歴
            </h2>

            {/* Visual Graph Area */}
            <ProgressChart workouts={workouts} />

            <div className="grid grid-cols-1 gap-4">
                {workouts.slice().reverse().map((log) => (
                    <div key={log.id} className="glass-card relative overflow-hidden group">
                        {/* PR Badge */}
                        {log.isPR && (
                            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded-bl-xl shadow-lg shadow-yellow-500/50 flex items-center gap-1">
                                <Trophy size={10} /> 自己ベスト更新！
                            </div>
                        )}

                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-xs font-mono text-gray-500 block mb-1">
                                    {new Date(log.timestamp).toLocaleDateString("ja-JP")} {new Date(log.timestamp).toLocaleTimeString("ja-JP", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <h3 className="text-lg font-bold text-white leading-none mb-2">{log.exercise}</h3>
                                <div className="flex gap-3 text-sm">
                                    <span className="text-blue-400 font-bold">{log.weight} <span className="text-xs text-gray-400">kg</span></span>
                                    <span className="text-gray-600">x</span>
                                    <span className="text-purple-400 font-bold">{log.reps} <span className="text-xs text-gray-400">reps</span></span>
                                </div>
                            </div>

                            {/* 1RM Calc */}
                            <div className="text-right">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">est. 1RM</span>
                                <div className="text-xl font-black text-white/20 group-hover:text-white/40 transition-colors">
                                    {log.oneRM}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
