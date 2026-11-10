/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Home, BarChart2, Settings, Timer, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { unlockAudio } from '../../lib/audio';

export default function FloatingNav({ activeTab, setActiveTab, workoutState = 'setup', onRecordClick, restTimer, setRestTimer, isTimerRunning, setIsTimerRunning }) {
    const [isPressed, setIsPressed] = useState(false);

    const toggleTimer = () => {
        unlockAudio();
        if (restTimer <= 0) {
            setRestTimer(120);
            setIsTimerRunning(true);
            localStorage.setItem('muscle-memo-timer-endtime', String(Date.now() + 120 * 1000));
        } else {
            setIsTimerRunning(!isTimerRunning);
        }
    };

    const handleTimerChange = (val) => {
        unlockAudio();
        const num = Number(val);
        setRestTimer(num);
        if (num <= 0) {
            setIsTimerRunning(false);
        }
    };

    const handleRecord = () => {
        setIsPressed(true);
        onRecordClick();
        setTimeout(() => setIsPressed(false), 200);
    };

    return (
        <div className="app-footer fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div className="app-footer-content w-full max-w-[480px] px-3 sm:px-4 pointer-events-auto">

                {/* Floating Action Panel (2nd Tier) - Only on Home Tab during Active Session */}
                {activeTab === 'home' && workoutState === 'active' && (
                    <div className="flex items-center justify-between mb-3 gap-2">
                        {/* Timer Widget */}
                        <div className={cn(
                            "flex-1 min-w-0 rounded-2xl p-1 flex items-center justify-between h-14 transition-all duration-300",
                            isTimerRunning 
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-500/30 shadow-lg shadow-blue-500/20" 
                                : "glass"
                        )}>
                            <button onClick={toggleTimer} aria-label="インターバルタイマーの開始・一時停止" className={cn("min-w-12 min-h-12 flex items-center justify-center rounded-xl transition-colors", isTimerRunning ? "text-white bg-white/15" : "text-slate-400")}>
                                <Timer size={24} />
                            </button>
                            <div className="flex-1 min-w-0 text-center font-mono text-xl font-bold">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    aria-label="タイマー残り秒数"
                                    min="0"
                                    value={restTimer}
                                    onChange={(e) => handleTimerChange(e.target.value)}
                                    className={cn(
                                        "bg-transparent w-full min-h-12 text-center outline-none font-extrabold",
                                        isTimerRunning ? "text-white text-2xl" : "text-slate-800"
                                    )}
                                />
                            </div>
                            <span className={cn("text-xs mr-2", isTimerRunning ? "text-blue-200" : "text-slate-500")}>秒</span>
                        </div>

                        {/* Record Button */}
                        <button
                            onClick={handleRecord}
                            className={cn(
                                "h-14 px-5 shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all transform",
                                isPressed ? "scale-90 bg-green-500" : "active:scale-95"
                            )}
                        >
                            <CheckCircle2 size={24} />
                            記録する
                        </button>
                    </div>
                )}

                {/* Navigation Bar (1st Tier) */}
                <nav aria-label="メインナビゲーション" className="glass rounded-full h-16 flex items-center justify-around px-2 relative overflow-hidden">
                    <NavIcon
                        icon={Home}
                        label="ホーム"
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
                "flex flex-col items-center justify-center w-20 h-full gap-1 transition-all duration-300 outline-none relative",
                isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
            )}
        >
            {/* Active indicator dot */}
            <div className={cn(
                "absolute -top-0.5 w-1 h-1 rounded-full bg-blue-600 transition-all duration-300",
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
            )} />
            <div className={cn(
                "absolute bg-blue-500 blur-xl opacity-0 transition-opacity duration-300 rounded-full w-8 h-8",
                isActive && "opacity-10"
            )} />
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={cn("transition-transform duration-300", isActive && "scale-110 -translate-y-0.5")} />
            <span className={cn(
                "text-[10px] font-bold tracking-wide transition-all duration-300",
                isActive && "text-blue-700 scale-105"
            )}>{label}</span>
        </button>
    )
}
