import React, { useState, useMemo } from 'react';
import { Area, AreaChart, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass p-3 rounded-xl border border-white/20 shadow-xl backdrop-blur-md bg-black/80">
                <p className="text-gray-400 text-xs font-mono mb-1">{label}</p>
                <p className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-black">{payload[0].value}</span>
                    <span className="text-xs font-normal text-gray-500">kg (1RM)</span>
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

    // Prepare data for the chart
    const data = useMemo(() => {
        if (!selectedExercise) return [];

        // Filter by exercise
        const filtered = workouts.filter(w => w.exercise === selectedExercise);

        // Sort by timestamp just in case
        filtered.sort((a, b) => a.timestamp - b.timestamp);

        // Map to simple structure
        return filtered.map(w => ({
            date: new Date(w.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
            oneRM: w.oneRM,
            rawWeight: w.weight,
            reps: w.reps
        }));
    }, [workouts, selectedExercise]);

    if (workouts.length === 0) return null;

    return (
        <div className="w-full space-y-4 mb-6">
            {/* Header & Selector */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wide">
                    <TrendingUp size={16} className="text-cyan-500" /> Progression
                </h3>

                {/* Exercise Selector */}
                <div className="relative">
                    <select
                        value={selectedExercise}
                        onChange={(e) => setSelectedExercise(e.target.value)}
                        className="bg-white/5 border border-white/10 text-white text-xs font-bold rounded-lg py-1 pl-2 pr-8 appearance-none focus:bg-white/10 outline-none transition-colors"
                    >
                        {uniqueExercises.map(ex => (
                            <option key={ex} value={ex} className="bg-black text-gray-200">
                                {ex}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-[10px]">
                        ▼
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="h-64 glass-card relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />

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

                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

                            <XAxis
                                dataKey="date"
                                stroke="#666"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#666"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={['dataMin - 5', 'dataMax + 5']}
                            />

                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />

                            <Line
                                type="monotone"
                                dataKey="oneRM"
                                stroke="url(#lineColor)"
                                strokeWidth={3}
                                dot={{ fill: '#000', stroke: '#00d2ff', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, fill: '#fff', stroke: '#00d2ff', strokeWidth: 2 }}
                                filter="url(#neon-glow)"
                                animationDuration={1500}
                                animationEasing="ease-in-out"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                        <Activity size={32} className="opacity-20" />
                        <span className="text-xs">Not enough data to graph</span>
                    </div>
                )}
            </div>
        </div>
    );
}
