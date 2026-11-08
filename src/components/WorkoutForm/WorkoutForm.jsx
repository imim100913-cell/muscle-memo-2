import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '../../lib/utils';
import { Dumbbell, Layers, Hash, History, CheckCircle2, Sparkles, Activity, AlertTriangle, Timer, Search, Plus, ArrowRight, X, Volume2, VolumeX, ThumbsUp, Target, XCircle, FileText } from 'lucide-react';
import { calculateNextTarget, isCompound, DEFAULT_EXERCISES } from '../../lib/trainingEngine';
import { triggerHaptic, requestNotificationPermission } from '../../lib/audio';

export default function WorkoutForm({ 
    onUpdate, 
    workouts = [], 
    onTriggerAi, 
    onSetTimer, 
    customExercises = {}, 
    onAddCustomExercise, 
    workoutState = 'setup', 
    setWorkoutState,
    memo: controlledMemo,
    onMemoChange
}) {
    const [activePart, setActivePart] = useState('胸');
    const [exercise, setExercise] = useState(() => {
        const presets = DEFAULT_EXERCISES['胸'] || [];
        return presets.length > 0 ? presets[0].name : '';
    });
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [rir, setRir] = useState('');
    const [localMemo, setLocalMemo] = useState('');
    const memo = controlledMemo !== undefined ? controlledMemo : localMemo;
    const handleSetMemo = (valOrFn) => {
        const nextVal = typeof valOrFn === 'function' ? valOrFn(memo) : valOrFn;
        if (onMemoChange) onMemoChange(nextVal);
        else setLocalMemo(nextVal);
    };
    const [interval, setIntervalVal] = useState(() => {
        const presets = DEFAULT_EXERCISES['胸'] || [];
        return presets.length > 0 && isCompound(presets[0].name) ? '180' : '120';
    });
    const [formScore, setFormScore] = useState('perfect');

    // UI Search & Custom inputs
    const [searchQuery, setSearchQuery] = useState('');
    const [customInput, setCustomInput] = useState('');
    
    // Mute/Silent audio mode state
    const [soundMode, setSoundMode] = useState(() => localStorage.getItem('muscle-memo-sound-mode') || 'sound');

    const toggleSoundMode = () => {
        const next = soundMode === 'sound' ? 'silent' : 'sound';
        setSoundMode(next);
        localStorage.setItem('muscle-memo-sound-mode', next);
    };

    // Refs to prevent AI spam
    const lastAiTriggerEx = useRef(null);

    // --- Sort Settings States ---
    const [customCategory, setCustomCategory] = useState('free_weight');
    const [categoryPriority, setCategoryPriority] = useState(() => {
        return localStorage.getItem('muscle-memo-category-priority') || 'free_weight';
    });
    const [isReorderMode, setIsReorderMode] = useState(false);

    const loadCustomOrder = (part) => {
        try {
            const val = localStorage.getItem(`muscle-memo-custom-order-${part}`);
            return val ? JSON.parse(val) : [];
        } catch {
            return [];
        }
    };
    
    const [customOrder, setCustomOrder] = useState(() => loadCustomOrder('胸'));

    const handleSaveCategoryPriority = (priority) => {
        setCategoryPriority(priority);
        localStorage.setItem('muscle-memo-category-priority', priority);
    };

    // --- Merge presets and customs ---
    const allExercises = useMemo(() => {
        const presets = DEFAULT_EXERCISES[activePart] || [];
        const customs = (customExercises[activePart] || []).map(item => {
            const isObject = typeof item === 'object' && item !== null;
            const name = isObject ? item.name : item;
            let category = isObject ? item.category : null;
            
            if (!category) {
                const isFree = name.includes("ダンベル") || name.includes("バーベル") || name.toLowerCase().includes("dumbbell") || name.toLowerCase().includes("barbell");
                category = isFree ? "free_weight" : "machine";
            }
            
            return {
                name,
                category,
                isCustom: true,
                mechanics: isCompound(name) ? "compound" : "isolation"
            };
        });
        return [...presets, ...customs];
    }, [activePart, customExercises]);

    // --- Logic: Search Filter ---
    const filteredExercises = useMemo(() => {
        if (!searchQuery.trim()) return allExercises;
        const q = searchQuery.toLowerCase();
        return allExercises.filter(ex => ex.name.toLowerCase().includes(q));
    }, [allExercises, searchQuery]);

    // --- Logic: Sorting and Custom Ordering ---
    const sortedExercises = useMemo(() => {
        let list = [...filteredExercises];

        list.sort((a, b) => {
            if (a.category === b.category) {
                // Within same category, use custom order or keep default order
                if (customOrder && customOrder.length > 0) {
                    const indexA = customOrder.indexOf(a.name);
                    const indexB = customOrder.indexOf(b.name);
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                }
                return 0;
            }
            // Sort by category priority
            if (categoryPriority === 'free_weight') {
                return a.category === 'free_weight' ? -1 : 1;
            } else {
                return a.category === 'machine' ? -1 : 1;
            }
        });

        return list;
    }, [filteredExercises, customOrder, categoryPriority]);

    const handleMoveExercise = (exerciseName, direction) => {
        const currentSortedNames = sortedExercises.map(ex => ex.name);
        const index = currentSortedNames.indexOf(exerciseName);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= currentSortedNames.length) return;

        // Swap items
        const updatedNames = [...currentSortedNames];
        updatedNames[index] = currentSortedNames[newIndex];
        updatedNames[newIndex] = currentSortedNames[index];

        // Save this order
        setCustomOrder(updatedNames);
        localStorage.setItem(`muscle-memo-custom-order-${activePart}`, JSON.stringify(updatedNames));
    };

    // --- Logic: Muscle Volume Tracker ---
    const todayVolume = useMemo(() => {
        if (!workouts || workouts.length === 0) return 0;
        const todayStr = new Date().toDateString();
        return workouts.filter(w => 
            w.part === activePart && 
            new Date(w.timestamp).toDateString() === todayStr
        ).length;
    }, [activePart, workouts]);

    // --- Logic: AI Recommended Target ---
    const aiTarget = useMemo(() => {
        return calculateNextTarget(exercise, workouts);
    }, [exercise, workouts]);

    // --- Logic: Full Previous Session ---
    const previousSessionLogs = useMemo(() => {
        if (!workouts || workouts.length === 0 || !exercise) return [];

        const history = workouts.filter(w => w.exercise === exercise).sort((a, b) => b.timestamp - a.timestamp);
        if (history.length === 0) return [];

        const todayStr = new Date().toDateString();
        const pastLogs = history.filter(w => new Date(w.timestamp).toDateString() !== todayStr);
        if (pastLogs.length === 0) return [];

        const lastDateString = new Date(pastLogs[0].timestamp).toDateString();
        return pastLogs.filter(w => new Date(w.timestamp).toDateString() === lastDateString).reverse();
    }, [exercise, workouts]);

    const lastSet = previousSessionLogs.length > 0 ? previousSessionLogs[previousSessionLogs.length - 1] : null;

    // --- Logic: Today's Session Logs ---
    const todaySessionLogs = useMemo(() => {
        if (!workouts || workouts.length === 0 || !exercise) return [];
        const todayStr = new Date().toDateString();
        return workouts.filter(w => 
            w.exercise === exercise && 
            new Date(w.timestamp).toDateString() === todayStr
        ).sort((a, b) => a.timestamp - b.timestamp);
    }, [exercise, workouts]);

    // --- AI Trigger Effect ---
    useEffect(() => {
        if (workoutState === 'active' && lastSet && exercise && exercise !== lastAiTriggerEx.current) {
            onTriggerAi({ type: 'EXERCISE_CHANGED', exercise });
            lastAiTriggerEx.current = exercise;
        }
    }, [exercise, lastSet, onTriggerAi, workoutState]);

    const handleRequestAdvice = () => {
        if (!exercise) return;
        onTriggerAi({ type: 'ADVICE_REQUEST', exercise });
    };

    const selectExercise = (nextEx) => {
        setExercise(nextEx);
        if (nextEx) {
            const target = calculateNextTarget(nextEx, workouts);
            setIntervalVal(String(target?.interval || (isCompound(nextEx) ? 180 : 120)));
        }
    };

    const handleStartSession = () => {
        triggerHaptic('medium');
        requestNotificationPermission();
        if (aiTarget?.weight && !weight) {
            setWeight(String(aiTarget.weight));
        } else if (lastSet?.weight && !weight) {
            setWeight(String(lastSet.weight));
        }
        if (!reps) {
            const numericTargetReps = parseInt(aiTarget?.reps, 10);
            if (!isNaN(numericTargetReps) && !String(aiTarget?.reps).includes('〜')) {
                setReps(String(numericTargetReps));
            } else if (lastSet?.reps) {
                setReps(String(lastSet.reps));
            }
        }
        if (rir === '' && aiTarget?.targetRir !== undefined) {
            setRir(String(aiTarget.targetRir));
        }
        if (aiTarget?.interval) {
            setIntervalVal(String(aiTarget.interval));
        }
        setWorkoutState('active');
    };

    useEffect(() => {
        onUpdate({ 
            part: activePart, 
            exercise, 
            weight, 
            reps, 
            formScore, 
            rir, 
            memo,
            interval: parseInt(interval, 10) || 120 
        });
    }, [activePart, exercise, weight, reps, formScore, rir, memo, interval, onUpdate]);

    // Helpers to quickly adjust weight, reps, RIR, and interval
    const adjustWeight = (amount) => {
        triggerHaptic('light');
        const base = lastSet ? parseFloat(lastSet.weight) : 60;
        const current = parseFloat(weight) || base;
        const next = Math.max(0, current + amount);
        setWeight(next.toString());
    };

    const adjustReps = (amount) => {
        triggerHaptic('light');
        const base = lastSet ? parseInt(lastSet.reps) : 10;
        const current = parseInt(reps) || base;
        const next = Math.max(0, current + amount);
        setReps(next.toString());
    };

    const adjustRir = (amount) => {
        triggerHaptic('light');
        const base = lastSet && lastSet.rir !== undefined ? parseInt(lastSet.rir) : 2;
        const current = rir !== '' ? parseInt(rir) : base;
        const next = Math.max(0, Math.min(5, current + amount));
        setRir(next.toString());
    };

    const adjustInterval = (amount) => {
        triggerHaptic('light');
        const current = parseInt(interval, 10) || 120;
        const next = Math.max(0, current + amount);
        setIntervalVal(next.toString());
    };

    const handleAddCustom = (e) => {
        e.preventDefault();
        const trimmed = customInput.trim();
        if (!trimmed) return;
        onAddCustomExercise(activePart, trimmed, customCategory);
        selectExercise(trimmed);
        setCustomInput('');
    };

    // ==========================================
    // = RENDER: SCREEN A - Setup / Menu Select =
    // ==========================================
    if (workoutState === 'setup') {
        return (
            <div className="w-full space-y-6 animate-fade-in">
                {/* Body Part Tabs */}
                <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar mask-fade-right">
                    {Object.keys(DEFAULT_EXERCISES).map((part) => (
                        <button
                            key={part}
                            type="button"
                            onClick={() => {
                                setActivePart(part);
                                setCustomOrder(loadCustomOrder(part));
                                setIsReorderMode(false);
                                const presets = DEFAULT_EXERCISES[part] || [];
                                const customs = customExercises[part] || [];
                                if (presets.length > 0) {
                                    selectExercise(presets[0].name);
                                } else if (customs.length > 0) {
                                    const firstCustom = customs[0];
                                    selectExercise(typeof firstCustom === 'object' && firstCustom !== null ? firstCustom.name : firstCustom);
                                } else {
                                    selectExercise('');
                                }
                                setSearchQuery('');
                                setCustomInput('');
                            }}
                            className={cn(
                                "px-5 py-2.5 rounded-full text-xs font-extrabold tracking-wide whitespace-nowrap transition-all outline-none",
                                activePart === part
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {part}
                        </button>
                    ))}
                </div>

                {/* Search & Custom Add Box */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 md:space-y-0 shadow-sm">
                    {/* Search Bar */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block flex items-center gap-1">
                            <Search size={10} className="text-blue-600" /> 種目名で検索
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 font-medium"
                            placeholder="種目を検索..."
                        />
                    </div>
                    {/* Add Custom Form */}
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block flex items-center gap-1">
                            <Plus size={10} className="text-blue-600" /> {activePart}の種目名を追加
                        </label>
                        <form onSubmit={handleAddCustom} className="space-y-2">
                            {/* Category Selector (Free Weight vs Machine) */}
                            <div className="flex gap-1.5 p-1 bg-slate-200/40 rounded-xl w-fit border border-slate-200/50">
                                <button
                                    type="button"
                                    onClick={() => setCustomCategory('free_weight')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[9px] font-extrabold transition-all outline-none flex items-center gap-1 active:scale-95",
                                        customCategory === 'free_weight'
                                            ? "bg-amber-500 text-white shadow-sm"
                                            : "text-slate-600 hover:bg-slate-100"
                                    )}
                                >
                                    🏋️ フリーウェイト
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomCategory('machine')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[9px] font-extrabold transition-all outline-none flex items-center gap-1 active:scale-95",
                                        customCategory === 'machine'
                                            ? "bg-cyan-600 text-white shadow-sm"
                                            : "text-slate-600 hover:bg-slate-100"
                                    )}
                                >
                                    🤖 マシン/その他
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customInput}
                                    onChange={(e) => setCustomInput(e.target.value)}
                                    className="flex-1 bg-white text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 font-medium"
                                    placeholder={`例：インクライン・フライ (${activePart})...`}
                                />
                                <button
                                    type="submit"
                                    className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex-shrink-0 outline-none shadow-sm"
                                >
                                    追加
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Sorted & Unified Exercise List */}
                <div className="space-y-4">
                    {/* Header with Sort Settings Panel */}
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-[11px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" /> 種目リスト ({sortedExercises.length}件)
                        </h4>
                        
                        <div className="flex gap-2">
                            {/* Category priority toggle */}
                            <button
                                type="button"
                                onClick={() => handleSaveCategoryPriority(categoryPriority === 'free_weight' ? 'machine' : 'free_weight')}
                                className="text-[9px] font-extrabold text-slate-600 border border-slate-200 px-2 py-1 rounded-lg bg-white shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1.5 outline-none active:scale-95"
                                title="カテゴリー優先順を切り替え"
                            >
                                {categoryPriority === 'free_weight' ? "🏋️ フリーウェイト優先" : "🤖 マシン優先"}
                            </button>
                            
                            {/* Reorder mode toggle */}
                            <button
                                type="button"
                                onClick={() => setIsReorderMode(!isReorderMode)}
                                className={cn(
                                    "text-[9px] font-extrabold border px-2 py-1 rounded-lg shadow-sm transition-all flex items-center gap-1 outline-none active:scale-95",
                                    isReorderMode
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                ↕️ 並び替え{isReorderMode ? "終了" : "モード"}
                            </button>
                        </div>
                    </div>

                    {sortedExercises.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sortedExercises.map(ex => {
                                const isSelected = exercise === ex.name;
                                return (
                                    <div
                                        key={ex.name}
                                        className={cn(
                                            "p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between outline-none min-h-[50px] shadow-sm",
                                            isSelected 
                                                ? "bg-blue-50/80 text-blue-600 border-blue-200 ring-1 ring-blue-100/50"
                                                : "bg-slate-50/60 text-slate-700 border-slate-200/80 hover:bg-slate-100/60"
                                        )}
                                    >
                                        {/* Clickable Area to Select Exercise */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isReorderMode) {
                                                    selectExercise(ex.name);
                                                }
                                            }}
                                            disabled={isReorderMode}
                                            className={cn(
                                                "flex-1 text-left flex items-center justify-between min-w-0 pr-2 h-full outline-none",
                                                isReorderMode ? "cursor-default" : "cursor-pointer active:scale-95"
                                            )}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="truncate leading-tight font-black">{ex.name}</span>
                                                {ex.isCustom && (
                                                    <span className="text-[7px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-extrabold flex-shrink-0">
                                                        カスタム
                                                    </span>
                                                )}
                                            </div>
                                            {/* Category Badge */}
                                            <span className={cn(
                                                "text-[8px] px-1.5 py-0.5 rounded-full font-extrabold flex-shrink-0 ml-2 shadow-sm border whitespace-nowrap",
                                                ex.category === 'free_weight'
                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                    : "bg-cyan-50 text-cyan-700 border-cyan-200"
                                            )}>
                                                {ex.category === 'free_weight' ? "フリーウェイト" : "マシン"}
                                            </span>
                                        </button>

                                        {/* Reorder Arrows (shown only in Reorder Mode) */}
                                        {isReorderMode && (
                                            <div className="flex gap-1 flex-shrink-0 pl-1 border-l border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveExercise(ex.name, -1)}
                                                    className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors active:scale-90 font-mono text-[10px]"
                                                    title="上に移動"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveExercise(ex.name, 1)}
                                                    className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors active:scale-90 font-mono text-[10px]"
                                                    title="下に移動"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl">
                            検索結果に一致する種目がありません。
                        </div>
                    )}
                </div>

                {/* Spacer to prevent content from being covered by the sticky bottom bar */}
                {exercise && <div className="h-28" />}

                {/* Session Start Trigger - Floating/Sticky above bottom navigation bar */}
                {exercise && (
                    <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center pointer-events-none animate-slide-up">
                        <div className="w-full max-w-[480px] px-4 pointer-events-auto">
                            <div className="p-3.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl space-y-2">
                                {lastSet && (
                                    <div className="text-center text-[10px] text-slate-500 font-medium">
                                        前回: <span className="font-bold text-slate-700">{lastSet.weight}kg × {lastSet.reps}回</span>
                                        <span className="text-slate-400 ml-1">(1RM: {lastSet.oneRM || '−'}kg)</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleStartSession}
                                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 tracking-wider relative overflow-hidden group outline-none"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                                    <ArrowRight size={14} className="animate-pulse relative z-10" />
                                    <span className="relative z-10">「{exercise}」のトレーニングセッションを開始する</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ==========================================
    // = RENDER: SCREEN B - Active Workouts Log =
    // ==========================================
    return (
        <div className="w-full space-y-6 animate-fade-in">
            {/* Header / Selector details */}
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="min-w-0">
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider block w-fit mb-1">
                        {activePart} • {isCompound(exercise) ? "多関節種目" : "単関節種目"}
                    </span>
                    <h2 className="text-sm font-black text-slate-800 truncate flex items-center gap-1.5">
                        <Dumbbell size={14} className="text-blue-600 flex-shrink-0" />
                        {exercise}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={() => setWorkoutState('setup')}
                    className="text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 px-2.5 py-1.5 rounded-lg bg-slate-50 text-[10px] font-bold active:scale-95 flex items-center gap-1 outline-none"
                >
                    <X size={12} /> 種目を変更
                </button>
            </div>

            {/* Muscle Volume Tracker */}
            <div className={cn(
                "p-3 rounded-xl border text-xs flex items-center justify-between transition-all duration-300",
                todayVolume >= 12
                    ? "border-red-200 bg-red-50 text-red-700 font-medium"
                    : todayVolume >= 9
                        ? "border-yellow-200 bg-yellow-50 text-yellow-800 font-medium"
                        : "border-slate-200 bg-slate-50 text-slate-700"
            )}>
                <div className="flex items-center gap-2 font-bold">
                    <Layers size={14} className={cn(
                        todayVolume >= 12 ? "text-red-500" : todayVolume >= 9 ? "text-yellow-600" : "text-slate-400"
                    )} />
                    <span>本日の【{activePart}】ボリューム: {todayVolume} / 12 セット</span>
                </div>
                {todayVolume >= 12 ? (
                    <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <AlertTriangle size={10} /> リミット到達・終了推奨
                    </span>
                ) : todayVolume >= 9 ? (
                    <span className="text-[10px] font-extrabold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle size={10} /> 推奨上限寸前
                    </span>
                ) : (
                    <span className="text-[10px] font-bold text-slate-500">
                        {9 - todayVolume > 0 ? `推奨域まであと ${9 - todayVolume}セット` : "推奨ボリューム域"}
                    </span>
                )}
            </div>

            {/* AI Target Recommendation Panel */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 pointer-events-none opacity-10">
                    <Sparkles size={48} className="text-blue-500" />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                        <Sparkles size={13} className="animate-pulse" />
                        Anti-Gravity 2.0 推奨ターゲット
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded-full">
                        {aiTarget.mesocycleWeek ? `メゾサイクル週 ${aiTarget.mesocycleWeek}/4` : (isCompound(exercise) ? "多関節 (3分)" : "単関節 (2分)")}
                    </span>
                </div>
                
                <div className="grid grid-cols-4 gap-1.5 py-1">
                    <div className="bg-white rounded-lg p-1.5 text-center border border-slate-200">
                        <span className="text-[8px] sm:text-[9px] text-slate-500 block">推奨重量</span>
                        <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                            {aiTarget.weight ? `${aiTarget.weight}kg` : "自己調整"}
                        </span>
                    </div>
                    <div className="bg-white rounded-lg p-1.5 text-center border border-slate-200">
                        <span className="text-[8px] sm:text-[9px] text-slate-500 block">推奨レップス</span>
                        <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">{aiTarget.reps}</span>
                    </div>
                    <div className="bg-white rounded-lg p-1.5 text-center border border-slate-200">
                        <span className="text-[8px] sm:text-[9px] text-slate-500 block">目標RIR</span>
                        <span className="text-xs sm:text-sm font-black text-blue-600 font-mono">RIR {aiTarget.targetRir}</span>
                    </div>
                    <div className="bg-white rounded-lg p-1.5 text-center border border-slate-200 flex flex-col justify-between items-center relative">
                        <span className="text-[8px] sm:text-[9px] text-slate-500 block w-full">タイマー</span>
                        <div className="flex items-center gap-1 mt-0.5 justify-center">
                            <button
                                type="button"
                                onClick={() => onSetTimer(aiTarget.interval)}
                                className="text-[9px] font-extrabold text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-0.5 active:scale-95 outline-none"
                            >
                                <Timer size={9} />
                                {aiTarget.interval / 60}分
                            </button>
                            <button
                                type="button"
                                onClick={toggleSoundMode}
                                className="text-slate-500 hover:text-slate-800 p-0.5 rounded transition-colors active:scale-90 outline-none"
                                title={soundMode === 'sound' ? '音声通知中 (ミュートする)' : 'サイレントモード (音を鳴らす)'}
                            >
                                {soundMode === 'sound' ? <Volume2 size={9} className="text-blue-600" /> : <VolumeX size={9} className="text-slate-400" />}
                            </button>
                        </div>
                    </div>
                </div>
                
                <p className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-200 pt-2 font-medium">
                    {aiTarget.mesocycleDesc && <span className="font-bold text-blue-700 block mb-0.5">{aiTarget.mesocycleDesc}</span>}
                    {aiTarget.reason}
                </p>
            </div>

            {/* Weight, Reps, RIR & Interval Grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm">
                    <label className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-1.5 truncate">
                        <Layers size={12} className="flex-shrink-0" /> 重量 (kg)
                    </label>
                    <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder={lastSet ? lastSet.weight.toString() : "60"}
                        className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-800 placeholder:text-slate-400 outline-none font-mono"
                    />
                    <div className="flex gap-0.5 sm:gap-1 mt-2.5">
                        {[-2.5, 2.5].map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => adjustWeight(val)}
                                className="flex-1 py-1 rounded bg-slate-50 border border-slate-200 text-[9px] sm:text-[10px] text-slate-700 font-extrabold hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all outline-none"
                            >
                                {val > 0 ? `+${val}` : val}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm">
                    <label className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-1.5 truncate">
                        <Hash size={12} className="flex-shrink-0" /> 回数 (Reps)
                    </label>
                    <input
                        type="number"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder={lastSet ? lastSet.reps.toString() : "10"}
                        className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-800 placeholder:text-slate-400 outline-none font-mono"
                    />
                    <div className="flex gap-0.5 sm:gap-1 mt-2.5">
                        {[-1, 1].map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => adjustReps(val)}
                                className="flex-1 py-1 rounded bg-slate-50 border border-slate-200 text-[9px] sm:text-[10px] text-slate-700 font-extrabold hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all outline-none"
                            >
                                {val > 0 ? `+${val}` : val}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm">
                    <label className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-1.5 truncate">
                        <Target size={12} className="flex-shrink-0" /> 余力 (RIR)
                    </label>
                    <input
                        type="number"
                        value={rir}
                        onChange={(e) => setRir(e.target.value)}
                        placeholder={lastSet && lastSet.rir !== undefined ? lastSet.rir.toString() : "2"}
                        className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-800 placeholder:text-slate-400 outline-none font-mono"
                        min="0"
                        max="5"
                    />
                    <div className="flex gap-0.5 sm:gap-1 mt-2.5">
                        {[-1, 1].map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => adjustRir(val)}
                                className="flex-1 py-1 rounded bg-slate-50 border border-slate-200 text-[9px] sm:text-[10px] text-slate-700 font-extrabold hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all outline-none"
                            >
                                {val > 0 ? `+${val}` : val}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm">
                    <label className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block flex items-center gap-1.5 truncate">
                        <Timer size={12} className="flex-shrink-0" /> インターバル (秒)
                    </label>
                    <input
                        type="number"
                        value={interval}
                        onChange={(e) => setIntervalVal(e.target.value)}
                        placeholder="120"
                        className="w-full bg-transparent text-xl sm:text-2xl font-black text-slate-800 placeholder:text-slate-400 outline-none font-mono"
                    />
                    <div className="flex gap-0.5 sm:gap-1 mt-2.5">
                        {[-30, 30].map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => adjustInterval(val)}
                                className="flex-1 py-1 rounded bg-slate-50 border border-slate-200 text-[9px] sm:text-[10px] text-slate-700 font-extrabold hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all outline-none"
                            >
                                {val > 0 ? `+${val}s` : `${val}s`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Free Memo / Set Note Input */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <FileText size={12} className="text-blue-600 flex-shrink-0" /> セット別 自由メモ (Memo)
                    </label>
                    <span className="text-[9px] text-slate-400 font-medium">RIRとセットで保存</span>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={memo}
                        onChange={(e) => handleSetMemo(e.target.value)}
                        placeholder="例: フォーム意識、トップで1秒静止、肘違和感なし..."
                        className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-xl px-3 py-2.5 pr-8 outline-none focus:bg-white focus:border-blue-500 transition-colors font-medium placeholder:text-slate-400"
                        maxLength={120}
                    />
                    {memo && (
                        <button
                            type="button"
                            onClick={() => handleSetMemo('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            title="メモをクリア"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {['フォーム重視', 'ドロップセット', '限界突破', 'ネガティブ意識', '軽め調整'].map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                handleSetMemo(prev => prev ? `${prev} / ${tag}` : tag);
                            }}
                            className="text-[9px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors active:scale-95 outline-none"
                        >
                            +{tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Form Quality Selector */}
            <div className="glass-card border border-slate-200 space-y-3">
                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block flex items-center gap-2">
                    <Activity size={14} /> フォーム品質 (Form Quality)
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { value: 'perfect', label: 'Perfect', desc: '完璧なフォーム', colorClass: 'border-green-600 text-green-700 bg-green-50 shadow-green-100/50', icon: CheckCircle2 },
                        { value: 'good', label: 'Good', desc: '通常フォーム', colorClass: 'border-blue-600 text-blue-700 bg-blue-50 shadow-blue-100/50', icon: ThumbsUp },
                        { value: 'fail', label: 'Fail (限界)', desc: 'フォーム崩れ', colorClass: 'border-red-600 text-red-700 bg-red-50 shadow-red-100/50', icon: XCircle }
                    ].map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setFormScore(item.value)}
                            className={cn(
                                "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all active:scale-95 outline-none",
                                formScore === item.value
                                    ? item.colorClass + " font-extrabold shadow-sm"
                                    : "border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-700"
                            )}
                        >
                            <item.icon size={16} className={formScore === item.value ? '' : 'opacity-40'} />
                            <span className="text-xs">{item.label}</span>
                            <span className="text-[9px] opacity-60 mt-0.5">{item.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* On-Demand AI Advice Button */}
            <button
                type="button"
                onClick={handleRequestAdvice}
                className="w-full py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-slate-800 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer outline-none"
            >
                <Sparkles size={13} className="text-blue-600 animate-pulse" />
                この種目のAIフォーム・アドバイスを求める
            </button>

            {/* Today's Session Sets Tracker (Immediate Feedback) */}
            {todaySessionLogs.length > 0 && (
                <div className="p-3 rounded-xl space-y-2 border border-green-200 bg-green-50/50 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs text-green-700 font-bold uppercase tracking-wider">
                        <CheckCircle2 size={12} />
                        本日の記録 ({todaySessionLogs.length}セット完了)
                    </div>
                    <div className="space-y-1.5">
                        {todaySessionLogs.map((log, index) => (
                            <div key={log.id} className="text-xs text-slate-600 border-b border-slate-100 pb-1.5 last:border-0 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="opacity-60 font-medium">セット {log.setNum || index + 1} ({log.formScore === 'perfect' ? 'Perfect' : log.formScore === 'good' ? 'Good' : 'Fail'})</span>
                                    <span>
                                        <span className="font-bold text-slate-800">{log.weight}kg</span> x {log.reps}回
                                        <span className="text-blue-600 font-bold text-[10px] ml-1.5 font-mono">RIR {log.rir !== undefined ? log.rir : '−'}</span>
                                        {log.isPR && <span className="text-[10px] text-yellow-600 font-bold ml-1.5">★PR</span>}
                                    </span>
                                </div>
                                {log.memo && (
                                    <div className="text-[10px] text-slate-600 bg-white/90 border border-slate-200/80 rounded-md px-2 py-0.5 w-fit flex items-center gap-1 font-medium">
                                        <span className="text-blue-500 font-bold">💬</span>
                                        <span>{log.memo}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Smart History Display (Full Log from Previous Session) */}
            {previousSessionLogs.length > 0 && (
                <div className="p-3 rounded-xl space-y-2 border border-slate-200 bg-slate-50 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold uppercase tracking-wider">
                        <History size={12} />
                        前回の記録 ({new Date(previousSessionLogs[0].timestamp).toLocaleDateString("ja-JP")})
                    </div>
                    <div className="space-y-1.5">
                        {previousSessionLogs.map((log, index) => (
                            <div key={log.id} className="text-xs text-slate-600 border-b border-slate-100 pb-1.5 last:border-0 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="opacity-60 font-medium">セット {log.setNum || index + 1} ({log.formScore === 'perfect' ? 'Perfect' : log.formScore === 'good' ? 'Good' : 'Fail'})</span>
                                    <span>
                                        <span className="font-bold text-slate-800">{log.weight}kg</span> x {log.reps}回
                                        <span className="text-blue-600 font-bold text-[10px] ml-1.5 font-mono">RIR {log.rir !== undefined ? log.rir : '−'}</span>
                                    </span>
                                </div>
                                {log.memo && (
                                    <div className="text-[10px] text-slate-600 bg-white/90 border border-slate-200/80 rounded-md px-2 py-0.5 w-fit flex items-center gap-1 font-medium">
                                        <span className="text-blue-500 font-bold">💬</span>
                                        <span>{log.memo}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* End Session Button */}
            <button
                type="button"
                onClick={() => setWorkoutState('setup')}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 outline-none"
            >
                セッション終了（メニュー選択へ戻る）
            </button>
        </div>
    );
}
