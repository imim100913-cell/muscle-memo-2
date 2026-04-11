import React, { useState, useEffect } from 'react';
import { Home, BarChart2, Settings, Timer, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FloatingNav({ activeTab, setActiveTab, onRecordClick }) {
    const [restTimer, setRestTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    useEffect(() => {
        let interval;
        if (isTimerRunning && restTimer > 0) {
            interval = setInterval(() => {
                setRestTimer((prev) => prev - 1);
            }, 1000);
        } else if (restTimer === 0) {
            setIsTimerRunning(false);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, restTimer]);

    const toggleTimer = () => {
        if (restTimer === 0) {
            setRestTimer(120);
            setIsTimerRunning(true);
        } else {
            setIsTimerRunning(!isTimerRunning);
        }
    };

    const handleRecord = () => {
        setIsPressed(true);
        onRecordClick();
        setTimeout(() => setIsPressed(false), 200);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div className="w-full max-w-[480px] px-4 pb-6 pointer-events-auto">

                {/* Floating Action Panel (2nd Tier) - Only on Home Tab */}
                {activeTab === 'home' && (
                    <div className="flex items-center justify-between mb-4 gap-4">
                        {/* Timer Widget */}
                        <div className="flex-1 glass rounded-2xl p-2 flex items-center justify-between h-14">
                            <button onClick={toggleTimer} className={cn("p-2 rounded-xl transition-colors", isTimerRunning ? "text-blue-400 bg-blue-500/10" : "text-gray-400")}>
                                <Timer size={24} />
                            </button>
                            <div className="flex-1 text-center font-mono text-xl font-bold text-white">
                                <input
                                    type="number"
                                    value={restTimer}
                                    onChange={(e) => setRestTimer(Number(e.target.value))}
                                    className="bg-transparent w-full text-center outline-none"
                                />
                            </div>
                            <span className="text-xs text-gray-500 mr-2">秒</span>
                        </div>

                        {/* Record Button */}
                        <button
                            onClick={handleRecord}
                            className={cn(
                                "h-14 px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/50 flex items-center gap-2 transition-all transform",
                                isPressed ? "scale-90 bg-green-500" : "active:scale-95"
                            )}
                        >
                            <CheckCircle2 size={24} />
                            記録する
                        </button>
                    </div>
                )}

                {/* Navigation Bar (1st Tier) */}
                <nav className="glass rounded-full h-16 flex items-center justify-around px-2 relative overflow-hidden">
                    <NavIcon
                        icon={Home}
                        label="AIトレーナー"
                        isActive={activeTab === 'home'}
                        onClick={() => setActiveTab('home')}
                    />
                    <NavIcon
                        icon={BarChart2}
                        label="記録・分析"
                        isActive={activeTab === 'history'}
                        onClick={() => setActiveTab('history')}
                    />
                    <NavIcon
                        icon={Settings}
                        label="設定"
                        isActive={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </nav>
            </div>
        </div>
    );
}

function NavIcon({ icon: Icon, label, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center w-20 h-full gap-1 transition-all duration-300",
                isActive ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
            )}
        >
            <div className={cn(
                "absolute bg-blue-500 blur-xl opacity-0 transition-opacity duration-300 rounded-full w-8 h-8",
                isActive && "opacity-20"
            )} />
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={cn("transition-transform", isActive && "scale-110")} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
        </button>
    )
}
