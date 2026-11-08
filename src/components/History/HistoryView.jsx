import React, { useMemo } from 'react';
import { Trophy, Calendar, CheckCircle2, ThumbsUp, XCircle, Dumbbell } from 'lucide-react';

import ProgressChart from './ProgressChart';

export default function HistoryView({ workouts }) {
    const groupedSessions = useMemo(() => {
        if (!workouts || workouts.length === 0) return [];
        
        const groups = {};
        workouts.forEach(w => {
            const date = new Date(w.timestamp).toLocaleDateString("ja-JP");
            const key = `${date}_${w.exercise}`;
            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    date,
                    exercise: w.exercise,
                    part: w.part,
                    timestamp: w.timestamp,
                    sets: [],
                    isPR: false,
                    max1RM: 0
                };
            }
            groups[key].sets.push(w);
            if (w.isPR) {
                groups[key].isPR = true;
            }
            if (w.oneRM > groups[key].max1RM) {
                groups[key].max1RM = w.oneRM;
            }
        });
        
        // Sort sessions descending (most recent first)
        return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
    }, [workouts]);

    if (!workouts || workouts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-5">
                    <Dumbbell size={36} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">まだ記録がありません</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-[240px]">
                    最初の一歩を踏み出しましょう！<br />トレーニングを記録して、成長を可視化しよう 💪
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 pb-24">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Calendar className="text-blue-600" /> トレーニング履歴
            </h2>

            {/* Visual Graph Area */}
            <ProgressChart workouts={workouts} />

            <div className="grid grid-cols-1 gap-4">
                {groupedSessions.map((session) => (
                    <div key={session.id} className="glass-card relative overflow-hidden group border border-slate-200 p-5 rounded-2xl shadow-sm space-y-3">
                        {/* PR Badge */}
                        {session.isPR && (
                            <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl shadow shadow-amber-500/10 flex items-center gap-1">
                                <Trophy size={10} /> 自己ベスト更新！
                            </div>
                        )}

                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-mono text-slate-400 block mb-1">
                                    {session.date}
                                </span>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-slate-800 leading-none">{session.exercise}</h3>
                                    <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{session.part}</span>
                                </div>
                            </div>

                            {/* 1RM Calc */}
                            <div className="text-right">
                                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold block">session max 1RM</span>
                                <div className="text-xl font-black text-slate-700 group-hover:text-slate-800 transition-colors font-mono">
                                    {session.max1RM} <span className="text-xs font-normal text-slate-400">kg</span>
                                </div>
                            </div>
                        </div>

                        {/* Sets list */}
                        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                            {session.sets.map((set, idx) => (
                                <div key={set.id} className="text-xs font-semibold text-slate-700 bg-slate-50/50 p-2 rounded-xl border border-slate-200/60 hover:bg-slate-100/50 transition-colors space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px]">{set.setNum || idx + 1}</span>
                                            <span className="font-bold text-blue-600">{set.weight} <span className="text-[9px] font-normal text-slate-400">kg</span></span>
                                            <span className="text-slate-400">x</span>
                                            <span className="font-bold text-indigo-600">{set.reps} <span className="text-[9px] font-normal text-slate-400">reps</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded-md font-bold">RIR {set.rir !== undefined ? set.rir : 2}</span>
                                            {set.interval !== undefined && (
                                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded-md font-bold">{set.interval}秒</span>
                                            )}
                                            {set.formScore && (
                                                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                    set.formScore === 'perfect' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                    set.formScore === 'good' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                    'bg-red-50 text-red-700 border border-red-200'
                                                }`}>
                                                    {set.formScore === 'perfect' ? <CheckCircle2 size={9} /> :
                                                     set.formScore === 'good' ? <ThumbsUp size={9} /> :
                                                     <XCircle size={9} />}
                                                    {set.formScore === 'perfect' ? 'Perfect' : set.formScore === 'good' ? 'Good' : 'Fail'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {set.memo && (
                                        <div className="text-[10px] text-slate-600 bg-white/90 border border-slate-200/80 rounded-md px-2 py-0.5 w-fit flex items-center gap-1 font-medium ml-7">
                                            <span className="text-blue-500 font-bold">💬</span>
                                            <span>{set.memo}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
