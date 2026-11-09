import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Dumbbell, CheckCircle2, Smartphone, Sun, RefreshCw, Download } from 'lucide-react';

import Layout from './components/Layout/Layout';
import FloatingNav from './components/Layout/FloatingNav';
import ChatInterface from './components/AICoach/ChatInterface';
import WorkoutForm from './components/WorkoutForm/WorkoutForm';
import HistoryView from './components/History/HistoryView';
import SettingsView from './components/Settings/SettingsView';
import Onboarding from './components/Onboarding/Onboarding';
import MobileSyncModal from './components/Mobile/MobileSyncModal';
import { RESET_BACKUP_KEY } from './lib/persistence.js';
import { decodeStoredValue } from './lib/storageSchema.js';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useMobileFeatures } from './hooks/useMobileFeatures';
import { calculate1RM, getLocalDateKey, createUniqueId } from './lib/utils';
import { migrateToFlatWorkouts, normalizeSingleSet } from './lib/workoutMigration.js';
import { GeminiService, parseGeminiError, DEFAULT_GEMINI_MODEL } from './services/gemini';
import { playBeep, unlockAudio, triggerHaptic, sendTimerNotification } from './lib/audio';
import { decodeSyncToken, applySyncedData } from './services/mobileSync';

// Local Fallback AI Triggers per Coach
const LOCAL_COACH_TRIGGERS = {
  'all-might': {
    greeting: (name) => `私が来た！ ${name}少年、今日のメニューは決まったかい？`,
    praise: () => ["限界を超えたな！素晴らしい！！", "Nice Fight! その調子だ！", "PLUS ULTRA!! 君は最強だ！"][Math.floor(Math.random() * 3)],
    chatReply: (text) => {
      const t = text.toLowerCase();
      if (t.includes('tired') || t.includes('疲れた') || t.includes('きつい')) return "限界の向こう側へ！！ Plus Ultra！！";
      if (t.includes('hello') || t.includes('こんにちは')) return "私が来た！ 今日の調子はどうだい？";
      if (t.includes('weight') || t.includes('重') || t.includes('advice')) return "重量は「ギリギリ10回上がる」のが理想だ！ 昨日の自分に勝て！";
      return "詳細を教えてくれ少年！ だが答えは一つ、やるかやるかだ！！";
    }
  },
  'demon': {
    greeting: (name) => `よお、${name}。チンタラしてんじゃねえぞ。今日のメニューは何だ？`,
    praise: () => ["フン、少しはマシな挙上をするようになったな！", "悪くない。だが、そこで満足するんじゃねえぞ！", "限界をこじ開けたな！次もその調子で行け！"][Math.floor(Math.random() * 3)],
    chatReply: (text) => {
      const t = text.toLowerCase();
      if (t.includes('tired') || t.includes('疲れた') || t.includes('きつい')) return "弱音を吐くな！筋肉はそこから成長するんだよ！";
      if (t.includes('hello') || t.includes('こんにちは')) return "おう。挨拶はいいからさっさとプレートを組め！";
      if (t.includes('weight') || t.includes('重') || t.includes('advice')) return "重量設定にビビるな！ギリギリコントロールできる高重量で攻めるのが鉄則だ！";
      return "能書きはいい、トレーニングで語れ！やるか、それとも逃げるかだ！";
    }
  },
  'gentle': {
    greeting: (name) => `こんにちは、${name}さん♪ 今日も無理のない範囲で、一緒に楽しく頑張りましょうね！`,
    praise: () => ["素晴らしいです！本当に頑張りましたね♪", "感動しちゃいました！その調子ですよ！", "頑張るあなたの姿、とっても素敵です！"][Math.floor(Math.random() * 3)],
    chatReply: (text) => {
      const t = text.toLowerCase();
      if (t.includes('tired') || t.includes('疲れた') || t.includes('きつい')) return "お疲れ様です！辛いときは無理せず、しっかり休んでくださいね。";
      if (t.includes('hello') || t.includes('こんにちは')) return "こんにちは！今日の調子はいかがですか？ゆっくり進めましょう。";
      if (t.includes('weight') || t.includes('重') || t.includes('advice')) return "無理な高重量より、効かせるフォームが大切ですよ。怪我だけは気をつけてくださいね。";
      return "色々お話ししてくださいね。私はいつでもあなたの味方ですからね♪";
    }
  },
  'professional': {
    greeting: (name) => `お疲れ様です、${name}さん。本日も生体力学的に最適なトレーニングパラメータを構成しましょう。`,
    praise: () => ["見事な漸進的過負荷の適用です。素晴らしい！", "推定1RMが向上しています。筋神経系の発達が見られますね！", "理想的な挙上速度とフォームです。非常に効率的です。"][Math.floor(Math.random() * 3)],
    chatReply: (text) => {
      const t = text.toLowerCase();
      if (t.includes('tired') || t.includes('疲れた') || t.includes('きつい')) return "中枢神経系および末梢疲労が蓄積している可能性があります。適切な休息時間を設定してください。";
      if (t.includes('hello') || t.includes('こんにちは')) return "こんにちは。今日のトレーニングメニューおよび設定値をご提示ください。";
      if (t.includes('weight') || t.includes('重') || t.includes('advice')) return "筋肥大を目的とする場合、8〜12RM（1RMの65〜80%）の負荷設計が推奨されます。";
      return "データおよび目標をお知らせください。科学的エビデンスに基づいて最適化された手法を解説します。";
    }
  }
};

function App() {
  // --- Persistent State (1 Set = 1 Record Unified Format) ---
  const [rawWorkouts, setRawWorkouts, storageError] = useLocalStorage('muscle-memo-workouts', []);

  const ledger = useMemo(() => {
    try { return { workouts: migrateToFlatWorkouts(rawWorkouts), error: null }; }
    catch { return { workouts: [], error: '記録データの検証に失敗しました。原本を保護するため記録・移行を停止しています。設定から原本を退避してください。' }; }
  }, [rawWorkouts]);
  const workouts = ledger.workouts;
  const sessionIdRef = useRef(null);
  const changeWorkoutState = useCallback(next => {
    if (next === 'active') sessionIdRef.current = createUniqueId();
    setWorkoutState(next);
  }, []);

  const [userName, setUserName] = useLocalStorage('muscle-memo-user', 'トレーニー');
  const [apiKey, setApiKey] = useLocalStorage('muscle-memo-gemini-key', '');
  const [geminiModel, setGeminiModel] = useLocalStorage('muscle-memo-gemini-model', DEFAULT_GEMINI_MODEL);
  const [coachType, setCoachType] = useLocalStorage('muscle-memo-coach', 'all-might');
  const [isOnboarded, setIsOnboarded] = useLocalStorage('muscle-memo-onboarded', false);
  const [customExercises, setCustomExercises] = useLocalStorage('muscle-memo-custom-exercises', {
    "胸": [],
    "背中": [],
    "肩": [],
    "脚": [],
    "腕": []
  });

  // --- Local State ---
  const [activeTab, setActiveTab] = useState('home');
  const [currentEntry, setCurrentEntry] = useState({ 
    part: '胸', 
    exercise: '', 
    weight: '', 
    reps: '', 
    rir: '',
    memo: '', 
    formScore: null,
    interval: 120 
  });
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [workoutState, setWorkoutState] = useState('setup');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(() => new URLSearchParams(window.location.search).get('sync') === 'lan');
  const [incomingSyncOffer, setIncomingSyncOffer] = useState(null);

  // --- Mobile & PWA Capabilities ---
  const {
    isWakeLockEnabled,
    wakeLockActive,
    toggleWakeLock,
    canInstallPwa,
    isStandalone,
    isIos,
    installPwa,
    updateAvailable,
    applyUpdate,
    checkForLatestVersion
  } = useMobileFeatures({
    autoWakeLock: workoutState === 'active' || isTimerRunning
  });

  // --- AI State ---
  const [messages, setMessages] = useState([]);
  const [isTalking, setIsTalking] = useState(false);

  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setHasUnread(false);
    }
  }, [isChatOpen]);

  // Only portable tokens can offer incoming data. Legacy ?sync=lan opens help.
  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    const detectIncomingSync = async () => {
      const request = ++sequence;
      await Promise.resolve();
      const hash = window.location.hash || '';

      // 1. Portable compressed URL (#sync=...)
      if (hash.includes('sync=')) {
        try {
          const token = hash.split('sync=')[1].split('&')[0];
          const decoded = await decodeSyncToken(token);
          if (!cancelled && request === sequence && decoded?.d) {
            setIncomingSyncOffer({
              type: 'url',
              source: '共有URLリンク',
              data: decoded.d
            });
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } catch {
          // Ignore malformed hash
        }
        return;
      }
    };
    detectIncomingSync();
    window.addEventListener('hashchange', detectIncomingSync);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', detectIncomingSync);
    };
  }, []);

  const handleAcceptIncomingSync = () => {
    if (!incomingSyncOffer?.data) return;
    try {
      applySyncedData(incomingSyncOffer.data, 'merge');
      triggerHaptic('success');
      setIncomingSyncOffer(null);
      window.location.reload();
    } catch (error) { window.alert(error.message); }
  };

  const handleSaveSettings = (newName, newApiKey, newCoach, newModel) => {
    const results = [setUserName(newName), setApiKey(newApiKey), setCoachType(newCoach)];
    if (newModel) results.push(setGeminiModel(newModel));
    const failure = results.find(result => !result.success);
    if (failure) window.alert(failure.error);
    return failure || { success: true };
  };

  const handleAddCustomExercise = (part, name, category) => {
    if (!name || !name.trim()) return;
    setCustomExercises(prev => {
      const list = prev[part] || [];
      const exists = list.some(item => {
        const itemName = typeof item === 'object' && item !== null ? item.name : item;
        return itemName.toLowerCase() === name.trim().toLowerCase();
      });
      if (exists) return prev;
      
      const newElement = { name: name.trim(), category };
      return {
        ...prev,
        [part]: [...list, newElement]
      };
    });
  };

  const feedbackTimeoutRef = useRef(null);
  const showFeedback = (msg) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedbackMsg(msg);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackMsg(null);
      feedbackTimeoutRef.current = null;
    }, 2200);
  };

  const handleSetRestTimer = (valOrFn) => {
    setRestTimer(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      if (isTimerRunning && next > 0) {
        localStorage.setItem('muscle-memo-timer-endtime', String(Date.now() + next * 1000));
      } else if (next <= 0) {
        localStorage.removeItem('muscle-memo-timer-endtime');
      }
      return next;
    });
  };

  const handleSetIsTimerRunning = (running) => {
    setIsTimerRunning(running);
    if (running && restTimer > 0) {
      localStorage.setItem('muscle-memo-timer-endtime', String(Date.now() + restTimer * 1000));
    } else if (!running) {
      localStorage.removeItem('muscle-memo-timer-endtime');
    }
  };

  // --- Helper to build structured training context ---
  const buildRichContext = (exerciseName, customWorkouts = workouts) => {
    if (!exerciseName) return "種目が選択されていません。";
    const todayStr = new Date().toDateString();
    
    // Filter workouts for this exercise and sort chronologically
    const exerciseHistory = customWorkouts
      .filter(w => w.exercise === exerciseName)
      .sort((a, b) => a.timestamp - b.timestamp);
      
    // Today's sets in this session
    const todaySets = exerciseHistory.filter(w => new Date(w.timestamp).toDateString() === todayStr && w.sessionId === sessionIdRef.current);
    
    // Past sessions (excluding today)
    const pastSets = exerciseHistory.filter(w => w.sessionId !== sessionIdRef.current);
    
    // Find last session date & logs
    let lastSessionDate = "なし";
    let lastSessionLogs = [];
    if (pastSets.length > 0) {
      const lastTimestamp = pastSets[pastSets.length - 1].timestamp;
      lastSessionDate = new Date(lastTimestamp).toLocaleDateString("ja-JP");
      const previousSessionId = pastSets[pastSets.length - 1].sessionId;
      lastSessionLogs = pastSets.filter(w => w.sessionId === previousSessionId);
    }

    // Max 1RM achieved
    const max1RM = exerciseHistory.reduce((max, w) => Math.max(max, w.oneRM), 0);

    return JSON.stringify({
      userProfile: { name: userName, coachType },
      currentExercise: exerciseName,
      todaySession: {
        sessionId: sessionIdRef.current,
        completedSetsCount: todaySets.length,
        sets: todaySets.map((s, idx) => ({ 
          id: s.id, sessionId: s.sessionId,
          setNum: s.setNum || (idx + 1), 
          weight: s.weight, 
          reps: s.reps, 
          rir: s.rir ?? null,
          memo: s.memo || '',
          oneRM: s.oneRM, 
          isPR: s.isPR, 
          formScore: s.formScore 
        }))
      },
      previousSession: {
        date: lastSessionDate,
        sets: lastSessionLogs.map((s, idx) => ({ 
          id: s.id, sessionId: s.sessionId,
          setNum: s.setNum || (idx + 1), 
          weight: s.weight, 
          reps: s.reps, 
          rir: s.rir ?? null,
          memo: s.memo || '',
          oneRM: s.oneRM, 
          formScore: s.formScore 
        }))
      },
      statistics: {
        allTimeMax1RM: max1RM > 0 ? `${max1RM}kg` : "記録なし",
        totalSetsLoggedForThisExercise: exerciseHistory.length
      }
    }, null, 2);
  };

  // Decrement timer & play synthetic Web Audio countdown ticks + Haptics + OS Notification
  useEffect(() => {
    let interval;
    if (isTimerRunning && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            localStorage.removeItem('muscle-memo-timer-endtime');
            playBeep(1200, 800); // 0s End alarm beep
            sendTimerNotification(
              "⚡ インターバル終了！",
              currentEntry.exercise
                ? `【${currentEntry.exercise}】次のセットに入りましょう！`
                : "休憩時間が終了しました。次のセットに入りましょう！"
            );
            showFeedback("インターバル終了！次のセットに入りましょう。");
            return 0;
          }
          const nextVal = prev - 1;
          // Play tick beep (800Hz, 100ms) for seconds 10 to 1
          if (nextVal <= 10 && nextVal > 0) {
            playBeep(800, 100);
            if (nextVal <= 3) triggerHaptic('light');
          }
          return nextVal;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerRunning]);

  // Handle visibility change to restore timer state precisely from system clock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const endTimeStr = localStorage.getItem('muscle-memo-timer-endtime');
        if (endTimeStr) {
          const endTime = parseInt(endTimeStr, 10);
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          if (remaining > 0) {
            setRestTimer(remaining);
            setIsTimerRunning(true);
          } else {
            setRestTimer(0);
            setIsTimerRunning(false);
            localStorage.removeItem('muscle-memo-timer-endtime');
            playBeep(1200, 800); // end alarm
            triggerHaptic('timerEnd');
            showFeedback("インターバルが終了しました！");
          }
        }
      }
    };
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const showSleepWarning = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 21 || hours < 5;
  }, []);

  // Sync greeting on coach change or user name change
  useEffect(() => {
    const coachTriggers = LOCAL_COACH_TRIGGERS[coachType] || LOCAL_COACH_TRIGGERS['all-might'];
    setMessages([
      { id: Date.now(), role: 'ai', text: coachTriggers.greeting(userName) }
    ]);
  }, [coachType, userName]);

  const addAiMessage = async (triggerTypeOrText, context = "") => {
    setIsTalking(true);

    const coachTriggers = LOCAL_COACH_TRIGGERS[coachType] || LOCAL_COACH_TRIGGERS['all-might'];

    // 1. Try Gemini API if key exists
    if (apiKey) {
      try {
        const prompt = typeof triggerTypeOrText === 'string' ? triggerTypeOrText : "Something went wrong";
        const aiText = await GeminiService.generateResponse(apiKey, prompt, context, coachType, geminiModel);
        
        const aiMsg = { id: Date.now(), role: 'ai', text: aiText };
        setMessages(prev => [...prev, aiMsg]);
        if (!isChatOpenRef.current) setHasUnread(true);
      } catch (e) {
        console.error('AI request failed');
        const parsedError = parseGeminiError(e);
        
        let coachIntro = "";
        if (coachType === 'demon') {
          coachIntro = "チッ、電波状態が悪いようだ...。だが接続エラーを言い訳にサボるんじゃねえぞ！";
        } else if (coachType === 'gentle') {
          coachIntro = "あら、電波の調子が悪いみたいです...。少し休憩して、もう一度試してみましょうね。";
        } else if (coachType === 'professional') {
          coachIntro = "システム接続エラー：Gemini APIとの通信に失敗しました。";
        } else {
          coachIntro = "む！通信障害か！？今は調子が悪いようだ...！";
        }

        const aiMsg = {
          id: Date.now(),
          role: 'ai',
          text: coachIntro,
          error: parsedError
        };
        setMessages(prev => [...prev, aiMsg]);
        if (!isChatOpenRef.current) setHasUnread(true);
      }
    }
    // 2. Fallback to Local Logic
    else {
      // Imitate delay for local too
      await new Promise(r => setTimeout(r, 600));

      let aiText = "";
      if (triggerTypeOrText === 'PRAISE') {
        aiText = coachTriggers.praise();
      } else {
        // Raw text fallback (Chat)
        aiText = coachTriggers.chatReply(triggerTypeOrText);
      }
      
      const aiMsg = { id: Date.now(), role: 'ai', text: aiText };
      setMessages(prev => [...prev, aiMsg]);
      if (!isChatOpenRef.current) setHasUnread(true);
    }

    setIsTalking(false);
  };

  const handleUserMessage = (text) => {
    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    const richContext = buildRichContext(currentEntry.exercise);

    // Pass to AI
    if (apiKey) {
      addAiMessage(text, richContext);
    } else {
      addAiMessage(text); // Will fall into chatReply fallback
    }
  };

  // --- App Logic ---
  const handleFormUpdate = useCallback((data) => {
    setCurrentEntry(prev => JSON.stringify(prev) === JSON.stringify(data) ? prev : data);
  }, []);

  // Trigger from WorkoutForm (Advice / Exercise changed)
  const handleAiTrigger = (trigger) => {
    if (typeof trigger === 'object' && trigger !== null) {
      const { type, exercise } = trigger;
      const richContext = buildRichContext(exercise);

      if (type === 'EXERCISE_CHANGED') {
        const prompt = `ユーザーが種目を「${exercise}」に変更しました。前回の進捗や本日のメニュー予定に軽く触れながら、短くトレーニングの意気込みを引き出す挨拶・アドバイスをしてください。`;
        addAiMessage(prompt, richContext);
      } else if (type === 'ADVICE_REQUEST') {
        const prompt = `ユーザーが「${exercise}」の具体的なトレーニングアドバイスを求めています。これまでの挙上履歴や最大1RM、今日の進捗を踏まえて、次のセットの目標重量とレップ数、および意識すべきフォームのコツや安全対策をアドバイスしてください。`;
        addAiMessage(prompt, richContext);
      }
    } else {
      addAiMessage(trigger, `User is selecting a new exercise.`);
    }
  };

  const handleRecord = () => {
    if (ledger.error) { showFeedback(ledger.error); return; }
    const { exercise, weight, reps, rir, memo, interval } = currentEntry;
    if (!exercise) {
      showFeedback("⚠️ 種目を選択してください！");
      return;
    }
    const w = Number(weight);
    const r = Number(reps);
    if (!weight || !reps || !Number.isFinite(w) || !Number.isSafeInteger(r) || w <= 0 || r <= 0) {
      showFeedback("⚠️ 重量と回数を入力してください！");
      return;
    }

    const rirVal = rir !== '' && rir != null ? Number(rir) : null;
    const memoVal = typeof memo === 'string' ? memo.trim() : '';
    const intervalVal = interval !== undefined && interval !== '' ? parseInt(interval, 10) : 120;
    const oneRM = calculate1RM(w, r);
    const timestamp = Date.now();
    const dateKey = getLocalDateKey(timestamp);

    // Number sets independently within this session and exercise
    const todaySets = workouts.filter(wItem => wItem.sessionId === sessionIdRef.current && wItem.exercise === exercise);
    if (todaySets.length >= 30) {
      alert("このセッションのこの種目のセット数が上限（30セット）に達しています。");
      return;
    }
    const setNum = todaySets.length + 1;

    const exerciseHistory = workouts.filter(wItem => wItem.exercise === exercise);
    const currentMax1RM = exerciseHistory.reduce((max, log) => Math.max(max, log.oneRM || 0), 0);
    const isPRVal = oneRM > currentMax1RM;

    // Create a new unified flat record (1 Set = 1 Record)
    const newRecord = {
      id: createUniqueId(),
      sessionId: sessionIdRef.current || (sessionIdRef.current = createUniqueId()),
      createdAt: timestamp,
      updatedAt: timestamp,
      date: dateKey,
      timestamp,
      part: currentEntry.part,
      exercise,
      setNum,
      weight: w,
      reps: r,
      rir: rirVal,
      memo: memoVal,
      formScore: currentEntry.formScore ?? null,
      interval: intervalVal,
      oneRM,
      isPR: isPRVal
    };

    let updatedWorkouts;
    try { updatedWorkouts = [...workouts, normalizeSingleSet(newRecord)]; }
    catch { showFeedback('入力値が不正です。記録していません。'); return; }
    const result = setRawWorkouts(updatedWorkouts);
    if (!result.success) { showFeedback(result.error); return; }

    // Clear free memo for the next set
    setCurrentEntry(prev => ({ ...prev, memo: '' }));

    // Start interval timer automatically on set completion
    if (intervalVal > 0) {
      unlockAudio();
      setRestTimer(intervalVal);
      setIsTimerRunning(true);
      try { localStorage.setItem('muscle-memo-timer-endtime', String(Date.now() + intervalVal * 1000)); } catch { /* Ledger already saved; timer is transient. */ }
    }

    // UI & Haptic Feedback
    triggerHaptic(isPRVal ? 'pr' : 'success');
    triggerConfetti();
    showFeedback(isPRVal ? "🏆 自己ベスト(PR)更新！インターバル開始" : "記録完了！インターバル開始");

    // AI Praise with Rich Context!
    const richContext = buildRichContext(exercise, updatedWorkouts);
    if (apiKey) {
      let prompt = `ユーザーが ${exercise} を ${w}kg x ${r}回 (RIR: ${rirVal ?? '未入力'}) 達成しました。本日のセット数としてはこれで ${setNum} セット目です。`;
      if (memoVal) {
        prompt += ` ユーザーのセット別メモ: 「${memoVal}」`;
      }
      if (isPRVal) prompt += " これは自己ベスト(PR)更新です！最大限に褒めちぎってください！";
      else prompt += " 今日のこれまでの進捗や前回の記録と比較して、現状のパフォーマンス分析と次のセットに向けた励ましを述べてください。";
      addAiMessage(prompt, richContext);
    } else {
      addAiMessage('PRAISE'); // Fallback key
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#007AFF', '#BF5AF2', '#FFD700']
    });
  };

  const clearData = () => {
    if (ledger.error) { window.alert(ledger.error); return { success: false }; }
    let deletedIds;
    let beforeReset;
    try {
      beforeReset = localStorage.getItem('muscle-memo-workouts') ?? '[]';
      const previous = localStorage.getItem('muscle-memo-deletion-state');
      deletedIds = previous ? decodeStoredValue('muscle-memo-deletion-state', previous).deletedIds : [];
    } catch { window.alert('削除情報を読み出せないため、初期化を停止しました。'); return { success: false }; }
    if (!Array.isArray(deletedIds) || !deletedIds.every(id => typeof id === 'string')) {
      window.alert('削除情報が不正なため、初期化を停止しました。'); return { success: false };
    }
    const result = setRawWorkouts([], {
      [RESET_BACKUP_KEY]: beforeReset,
      'muscle-memo-deletion-state': JSON.stringify({ deletedIds: [...new Set([...deletedIds, ...workouts.map(w => w.id)])], deletedAt: Date.now() }),
      'muscle-memo-user': JSON.stringify('トレーニー'),
      'muscle-memo-coach': JSON.stringify('all-might'),
      'muscle-memo-gemini-key': JSON.stringify(''),
      'muscle-memo-gemini-model': JSON.stringify(DEFAULT_GEMINI_MODEL),
      'muscle-memo-custom-exercises': JSON.stringify({ 胸: [], 背中: [], 肩: [], 脚: [], 腕: [] }),
      'muscle-memo-onboarded': JSON.stringify(false)
    });
    if (!result.success) { window.alert(result.error); return result; }
    // Reload all hooks from one committed snapshot; no second storage transaction.
    try { localStorage.removeItem('muscle-memo-timer-endtime'); } catch { /* transient timer only */ }
    window.location.reload();
    return result;
  };

  const mobileSyncModal = (
    <MobileSyncModal
      isOpen={isSyncModalOpen}
      onClose={() => setIsSyncModalOpen(false)}
      onShowFeedback={showFeedback}
      canInstallPwa={canInstallPwa}
      isStandalone={isStandalone}
      isIos={isIos}
      onInstallPwa={installPwa}
    />
  );

  if (!isOnboarded && storageError) {
    return <div role="alert" className="p-6 text-red-800">{storageError} ブラウザの保存設定を確認して再読み込みしてください。</div>;
  }

  if (!isOnboarded) {
    return (
      <>
        {incomingSyncOffer && (
          <div className="fixed top-4 left-4 right-4 z-50 max-w-[440px] mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl shadow-2xl border border-blue-400/40 space-y-2.5 animate-fade-in">
            <div className="text-xs font-black flex items-center gap-2">
              <Smartphone size={16} />
              <span>{incomingSyncOffer.source}から設定・履歴データが届いています！</span>
            </div>
            <p className="text-[11px] text-blue-100 leading-relaxed">
              初期設定をスキップして、これまでの記録・AIコーチ設定をワンタップで引き継ぎますか？
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAcceptIncomingSync}
                className="flex-1 py-2 bg-white text-blue-700 rounded-xl text-xs font-extrabold shadow active:scale-95 transition-all"
              >
                今すぐ引き継いで開始
              </button>
              <button
                type="button"
                onClick={() => setIncomingSyncOffer(null)}
                className="px-3 py-2 bg-blue-700/60 text-blue-100 rounded-xl text-xs font-bold"
              >
                新規で始める
              </button>
            </div>
          </div>
        )}
        {mobileSyncModal}
        <Onboarding
          onComplete={(data) => {
            const results = [setUserName(data.userName), setApiKey(data.apiKey), setCoachType(data.coachType)];
            if (data.exercisePreferences?.length) {
              const next = { ...customExercises };
              for (const ex of data.exercisePreferences) next[ex.part] = [...(next[ex.part] || []), ex];
              results.push(setCustomExercises(next));
            }
            const failure = results.find(result => !result.success);
            if (failure) { window.alert(failure.error); return; }
            const result = setIsOnboarded(true);
            if (!result.success) window.alert(result.error);
          }}
        />
      </>
    );
  }

  return (
    <Layout>
      <main className="flex-1 w-full text-slate-800">
        {(ledger.error || storageError) && <div role="alert" className="p-4 bg-red-50 text-red-800">
          {ledger.error || storageError}
          <button type="button" onClick={() => {
            const blob = new Blob([JSON.stringify({ entry: currentEntry, original: localStorage.getItem('muscle-memo-workouts') }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = 'muscle-memo-recovery.json'; link.click(); URL.revokeObjectURL(url);
          }}>未保存入力と原本を退避</button>
        </div>}
        {/* Instant New Version Available Banner (PWA Auto-Update) */}
        {updateAvailable && (
          <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl text-white text-xs font-bold flex items-center justify-between shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" />
              <span>最新バージョンのアプリが利用可能です！</span>
            </div>
            <button
              type="button"
              onClick={applyUpdate}
              className="px-3 py-1 bg-white text-emerald-700 rounded-full text-[11px] font-extrabold shadow-sm active:scale-95 transition-all"
            >
              今すぐ更新
            </button>
          </div>
        )}

        {/* Incoming QR / URL Data Sync Banner */}
        {incomingSyncOffer && (
          <div className="mx-4 mt-3 p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white text-xs space-y-2 shadow-lg animate-fade-in">
            <div className="font-black flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Download size={14} /> {incomingSyncOffer.source}の最新データを受信しました
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAcceptIncomingSync}
                className="flex-1 py-2 bg-white text-blue-700 rounded-xl text-[11px] font-extrabold shadow active:scale-95 transition-all"
              >
                データをスマート統合して反映
              </button>
              <button
                type="button"
                onClick={() => setIncomingSyncOffer(null)}
                className="px-3 py-2 bg-white/15 text-white rounded-xl text-[11px] font-bold"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* Global Quick Session Return Banner */}
        {workoutState === 'active' && activeTab !== 'home' && (
          <div 
            onClick={() => setActiveTab('home')}
            className="mx-4 mt-4 p-3.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl border border-blue-400/20 text-white text-xs font-bold flex items-center justify-between cursor-pointer animate-pulse active:scale-95 transition-all shadow-lg pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <Dumbbell size={14} className="animate-pulse text-cyan-300" />
              <span>進行中のセッション 【{currentEntry.exercise}】 に戻る</span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold">戻る ➜</span>
          </div>
        )}

        {showSleepWarning && (
          <div className="mx-4 mt-4 glass p-3.5 rounded-xl border border-yellow-300 bg-yellow-50/90 flex items-start gap-3 animate-pulse shadow-sm">
            <span className="text-amber-600 text-lg leading-none">⚠️</span>
            <div className="flex-1 text-[11px] text-yellow-900 leading-normal font-semibold">
              <span className="font-bold text-amber-700 block mb-0.5">22:30完全消灯・回復優先アラート</span>
              夜間帯に入っています。睡眠アンカーを守るため、中枢神経系（CNS）を興奮させる高強度挙上は避け、クールダウンに入ってください。
            </div>
          </div>
        )}

        {/* === TAB A: CHAT & LOG === */}
        {/* Keep the draft's local fields mounted while another tab is visible. */}
          <div hidden={activeTab !== 'home'} className="p-4 pt-6 pb-32 space-y-5">
            <header className="flex justify-between items-center gap-2 mb-1">
              <div>
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Training Session</span>
                <div className="text-xs text-slate-800 font-bold mt-0.5">{new Date().toLocaleDateString("ja-JP", { weekday: 'long', month: 'short', day: 'numeric' })}</div>
              </div>

              {/* Quick Mobile Actions: Wake Lock & Smartphone QR Bridge */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    toggleWakeLock();
                    showFeedback(!isWakeLockEnabled ? "画面スリープ防止をONにしました" : "画面スリープ防止をOFFにしました");
                  }}
                  title="トレーニング中のスマホ画面消灯防止 (Wake Lock)"
                  className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-extrabold flex items-center gap-1 transition-all active:scale-95 ${
                    isWakeLockEnabled
                      ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                      : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}
                >
                  <Sun size={12} className={wakeLockActive ? 'text-amber-500 animate-spin-slow' : ''} />
                  <span className="hidden sm:inline">{isWakeLockEnabled ? '常時点灯' : '自動消灯'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setIsSyncModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Smartphone size={12} />
                  <span>スマホ連携</span>
                </button>
              </div>
            </header>

            <WorkoutForm
              onUpdate={handleFormUpdate}
              workouts={workouts}
              onTriggerAi={handleAiTrigger}
              onSetTimer={(seconds) => {
                unlockAudio();
                setRestTimer(seconds);
                setIsTimerRunning(true);
                localStorage.setItem('muscle-memo-timer-endtime', String(Date.now() + seconds * 1000));
              }}
              customExercises={customExercises}
              onAddCustomExercise={handleAddCustomExercise}
              workoutState={workoutState}
              setWorkoutState={changeWorkoutState}
              memo={currentEntry.memo}
              onMemoChange={(val) => setCurrentEntry(prev => {
                const next = typeof val === 'function' ? val(prev.memo) : val;
                return typeof next === 'string' ? { ...prev, memo: next } : prev;
              })}
            />


          </div>

        {/* === TAB B: HISTORY === */}
        {activeTab === 'history' && (
          <div className="pt-8">
            <HistoryView workouts={workouts} />
          </div>
        )}

        {/* === TAB C: SETTINGS === */}
        {activeTab === 'settings' && (
          <div className="pt-8">
            <SettingsView
              userName={userName}
              setUserName={setUserName}
              apiKey={apiKey}
              setApiKey={setApiKey}
              coachType={coachType}
              setCoachType={setCoachType}
              onClearData={clearData}
              workouts={workouts}
              onShowFeedback={showFeedback}
              onSaveSettings={handleSaveSettings}
              geminiModel={geminiModel}
              setGeminiModel={setGeminiModel}
              onOpenMobileSync={() => setIsSyncModalOpen(true)}
              isWakeLockEnabled={isWakeLockEnabled}
              onToggleWakeLock={toggleWakeLock}
              onCheckUpdate={checkForLatestVersion}
            />
          </div>
        )}
      </main>

      {mobileSyncModal}

      <FloatingNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workoutState={workoutState}
        onRecordClick={handleRecord}
        restTimer={restTimer}
        setRestTimer={handleSetRestTimer}
        isTimerRunning={isTimerRunning}
        setIsTimerRunning={handleSetIsTimerRunning}
      />

      {/* Floating Chat Bubble (LINE-style) - Visible on Home tab when chat is closed */}
      {!isChatOpen && activeTab === 'home' && (
        <div className="fixed bottom-44 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="w-full max-w-[480px] px-4 flex justify-end">
            <div className="relative pointer-events-auto">
              <button
                onClick={() => setIsChatOpen(true)}
                className="w-14 h-14 rounded-full border-2 bg-white shadow-xl flex items-center justify-center overflow-hidden transition-all duration-300 transform hover:scale-105 active:scale-95 animate-bounce-subtle outline-none"
                style={{
                  borderColor: coachType === 'all-might' ? '#F59E0B' : coachType === 'demon' ? '#DC2626' : coachType === 'gentle' ? '#22C55E' : '#0891B2',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
                }}
              >
                <img 
                  src={coachType === 'all-might' ? './coach_all_might.png' : coachType === 'demon' ? './coach_demon.png' : coachType === 'gentle' ? './coach_gentle.png' : './coach_professional.png'} 
                  alt="AI Coach Chat" 
                  className="w-full h-full object-cover"
                />
              </button>

              {/* Unread Message Badge */}
              {hasUnread && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 z-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] text-white font-extrabold items-center justify-center">
                    💬
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Modal Sheet */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
          {/* Backdrop */}
          <div 
            onClick={() => setIsChatOpen(false)} 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto transition-opacity duration-300"
          />
          
          {/* Sliding Panel */}
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl border-t border-slate-200/80 shadow-2xl p-5 pb-8 pointer-events-auto relative z-10 animate-slide-up">
            <ChatInterface
              messages={messages}
              isTalking={isTalking}
              onSendMessage={handleUserMessage}
              coachType={coachType}
              isModal={true}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="fixed inset-0 pointer-events-none flex items-end justify-center z-50 pb-44">
          <div className="bg-blue-600/95 text-white px-8 py-3.5 rounded-2xl text-sm font-bold tracking-wider shadow-2xl backdrop-blur-sm border border-blue-400/30 fade-in flex items-center gap-2">
            <CheckCircle2 size={18} className="text-blue-200" />
            {feedbackMsg}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
