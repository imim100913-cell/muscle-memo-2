import React, { useState, useMemo } from 'react';
import { Area, AreaChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-lg">
                <p className="text-slate-500 text-xs font-mono mb-1">{label}</p>
                <p className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-blue-600 font-black font-mono">{payload[0].value}</span>
                    <span className="text-xs font-normal text-slate-400">kg (1RM)</span>
                </p>
            </div>
        );
    }
    return null;
};

export default function ProgressChart({ workouts }) {
    // Extract unique exercises from history
    const uniqueExercises = useMemo(() => {
        const exercises = new Set(workouts.map(w => w.exercise));
        return Array.from(exercises);
    }, [workouts]);

    // Default to the most recent exercise's name, or the first available
    const [selectedExercise, setSelectedExercise] = useState(() => {
        if (workouts.length > 0) return workouts[workouts.length - 1].exercise;
        return uniqueExercises[0] || "";
    });

    const activeExercise = useMemo(() => {
        if (selectedExercise && uniqueExercises.includes(selectedExercise)) {
            return selectedExercise;
        }
        if (workouts.length > 0) return workouts[workouts.length - 1].exercise;
        return uniqueExercises[0] || "";
    }, [selectedExercise, uniqueExercises, workouts]);

    // Prepare data for the chart
    const data = useMemo(() => {
        if (!activeExercise) return [];

        const filtered = workouts.filter(w => w.exercise === activeExercise);
        
        // Group by date to find peak 1RM per day
        const dailyPeaks = {};
        filtered.forEach(w => {
            const dateStr = new Date(w.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' });
            const existing = dailyPeaks[dateStr];
            if (!existing || w.oneRM > existing.oneRM) {
                dailyPeaks[dateStr] = {
                    date: dateStr,
                    oneRM: w.oneRM,
                    rawWeight: w.weight,
                    reps: w.reps,
                    timestamp: w.timestamp
                };
            }
        });

        return Object.values(dailyPeaks).sort((a, b) => a.timestamp - b.timestamp);
    }, [workouts, activeExercise]);

    if (workouts.length === 0) return null;

    return (
        <div className="w-full space-y-4 mb-6">
            {/* Header & Selector */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                    <TrendingUp size={16} className="text-blue-600" /> 1RM 推移グラフ
                </h3>

                {/* Exercise Selector */}
                <div className="relative">
                    <select
                        value={activeExercise}
                        onChange={(e) => setSelectedExercise(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg py-1 pl-2 pr-8 appearance-none focus:bg-slate-100 outline-none transition-colors"
                    >
                        {uniqueExercises.map(ex => (
                            <option key={ex} value={ex} className="bg-white text-slate-800">
                                {ex}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                        ▼
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 glass-card relative overflow-hidden border border-slate-200 shadow-sm">
                {/* Background Decoration */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />

                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="lineColor" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#00d2ff" />
                                    <stop offset="100%" stopColor="#3a7bd5" />
                                </linearGradient>
                                <filter id="neon-glow" height="300%" width="300%" x="-75%" y="-75%">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />

                            <XAxis
                                dataKey="date"
                                stroke="#94A3B8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#94A3B8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={['dataMin - 5', 'dataMax + 5']}
                            />

                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148, 163, 184, 0.3)', strokeWidth: 1 }} />

                            <Line
                                type="monotone"
                                dataKey="oneRM"
                                stroke="url(#lineColor)"
                                strokeWidth={3}
                                dot={{ fill: '#ffffff', stroke: '#2563EB', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, fill: '#2563EB', stroke: '#ffffff', strokeWidth: 2 }}
                                animationDuration={1500}
                                animationEasing="ease-in-out"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Activity size={32} className="opacity-20" />
                        <span className="text-xs">グラフを表示するデータがまだありません</span>
                    </div>
                )}
            </div>
        </div>
    );
}
