import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';

import Layout from './components/Layout/Layout';
import FloatingNav from './components/Layout/FloatingNav';
import ChatInterface from './components/AICoach/ChatInterface';
import WorkoutForm from './components/WorkoutForm/WorkoutForm';
import HistoryView from './components/History/HistoryView';
import SettingsView from './components/Settings/SettingsView';
import { useLocalStorage } from './hooks/useLocalStorage';
import { calculate1RM } from './lib/utils';
import { GeminiService } from './services/gemini';

// AI Logic Types (Fallback / Static)
const AI_TRIGGERS = {
  GREETING: (name) => `私が来た！ ${name}少年、今日のメニューは決まったかい？`,
  PRAISE: () => ["限界を超えたな！素晴らしい！！", "Nice Fight! その調子だ！", "PLUS ULTRA!! 君は最強だ！"][Math.floor(Math.random() * 3)],
  CHAT_REPLY: (text) => {
    const t = text.toLowerCase();
    if (t.includes('tired') || t.includes('疲れた') || t.includes('きつい')) return "限界の向こう側へ！！ Plus Ultra！！";
    if (t.includes('hello') || t.includes('こんにちは')) return "私が来た！ 今日の調子はどうだい？";
    if (t.includes('weight') || t.includes('重') || t.includes('advice')) return "重量は「ギリギリ10回上がる」のが理想だ！ 昨日の自分に勝て！";
    return "詳細を教えてくれ少年！ だが答えは一つ、やるかやるかだ！！";
  }
};

function App() {
  // --- Persistent State ---
  const [workouts, setWorkouts] = useLocalStorage('muscle-memo-workouts', []);
  const [userName, setUserName] = useLocalStorage('muscle-memo-user', 'hero');
  const [apiKey, setApiKey] = useLocalStorage('muscle-memo-gemini-key', '');

  // --- Local State ---
  const [activeTab, setActiveTab] = useState('home');
  const [currentEntry, setCurrentEntry] = useState({ part: 'CHEST', exercise: '', weight: '', reps: '' });
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // --- AI State ---
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: AI_TRIGGERS.GREETING(userName) }
  ]);
  const [isTalking, setIsTalking] = useState(false);

  // --- AI Logic (Hybrid) ---
  const addAiMessage = async (triggerTypeOrText, context = "") => {
    setIsTalking(true);

    let aiText = "";

    // 1. Try Gemini API if key exists
    if (apiKey) {
      // Show loading or "..." state conceptually by being in 'isTalking'
      try {
        const prompt = typeof triggerTypeOrText === 'string' ? triggerTypeOrText : "Something went wrong";
        aiText = await GeminiService.generateResponse(apiKey, prompt, context);
      } catch (e) {
        console.error(e);
        aiText = "通信エラーだ！だが挫けるな！ (API Error)";
      }
    }
    // 2. Fallback to Local Logic
    else {
      // Imitate delay for local too
      await new Promise(r => setTimeout(r, 600));

      if (typeof triggerTypeOrText === 'function') {
        // It's a fallback function from AI_TRIGGERS
        aiText = triggerTypeOrText();
      } else if (AI_TRIGGERS[triggerTypeOrText]) {
        // It's a key like 'PRAISE'
        aiText = AI_TRIGGERS[triggerTypeOrText]();
      } else {
        // Raw text fallback (Chat)
        aiText = AI_TRIGGERS.CHAT_REPLY(triggerTypeOrText);
      }
    }

    const aiMsg = { id: Date.now(), role: 'ai', text: aiText };
    setMessages(prev => [...prev, aiMsg]);
    setIsTalking(false);
  };

  const handleUserMessage = (text) => {
    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // Pass to AI
    if (apiKey) {
      addAiMessage(text, `User Name: ${userName}`);
    } else {
      addAiMessage(text); // Will fall into CHAT_REPLY fallback because it's a string not in AI_TRIGGERS keys
    }
  };

  // --- App Logic ---
  const handleFormUpdate = (data) => {
    setCurrentEntry(data);
  };

  // Trigger from WorkoutForm (Advice)
  const handleAiTrigger = (textOrPrompt) => {
    // If API: textOrPrompt is the full prompt constructed by WorkoutForm
    // If Local: We previously passed a specific string. 
    // Let's standardize: WorkoutForm sends a "Prompt String".

    // If we are using API, we want the prompt. 
    // If we are using Local, we might want to parse it or just use a generic advice.
    // Since WorkoutForm was sending "Bench Press info...", let's just pass that as the prompt.

    // Context for API
    addAiMessage(textOrPrompt, "User is selecting a new exercise.");
  }


  const handleRecord = () => {
    const { exercise, weight, reps } = currentEntry;
    if (!exercise || !weight || !reps) return;

    const w = parseFloat(weight);
    const r = parseFloat(reps);
    const oneRM = calculate1RM(w, r);
    const timestamp = Date.now();

    const newLog = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp,
      ...currentEntry,
      weight: w,
      reps: r,
      oneRM,
      isPR: false
    };

    // PR Check
    const exerciseHistory = workouts.filter(w => w.exercise === exercise);
    const currentMax1RM = exerciseHistory.reduce((max, log) => Math.max(max, log.oneRM || 0), 0);
    newLog.isPR = oneRM > currentMax1RM;

    setWorkouts(prev => [...prev, newLog]);

    // UI Feedback
    triggerConfetti();
    setFeedbackMsg("記録完了！");
    setTimeout(() => setFeedbackMsg(null), 2000);

    // AI Praise
    if (apiKey) {
      let prompt = `ユーザーが ${exercise} を ${w}kg x ${r}回 達成した。`;
      if (newLog.isPR) prompt += " これは自己ベスト(PR)更新だ！最大限に褒めちぎれ！";
      else prompt += " 素晴らしい努力だ。";
      addAiMessage(prompt, "Just finished a set.");
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
    setWorkouts([]);
    setUserName('hero');
  };

  return (
    <Layout>
      <main className="flex-1 w-full">
        {/* === TAB A: CHAT & LOG === */}
        {activeTab === 'home' && (
          <div className="p-4 pt-8 pb-32 animate-fade-in space-y-6">
            <header className="flex justify-between items-end mb-2">
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter text-white">
                  Muscle Memo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">2.0</span>
                </h1>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400">ユーザー名</span>
                <div className="text-sm font-bold text-white">{userName}</div>
              </div>
            </header>

            <ChatInterface
              messages={messages}
              isTalking={isTalking}
              onSendMessage={handleUserMessage}
              userName={userName}
            />

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <WorkoutForm
              onUpdate={handleFormUpdate}
              workouts={workouts}
              onTriggerAi={handleAiTrigger}
            />
          </div>
        )}

        {/* === TAB B: HISTORY === */}
        {activeTab === 'history' && (
          <div className="pt-8 animate-fade-in">
            <HistoryView workouts={workouts} />
          </div>
        )}

        {/* === TAB C: SETTINGS === */}
        {activeTab === 'settings' && (
          <div className="pt-8 animate-fade-in">
            <SettingsView
              userName={userName}
              setUserName={setUserName}
              apiKey={apiKey}
              setApiKey={setApiKey}
              onClearData={clearData}
              workouts={workouts}
              onShowFeedback={setFeedbackMsg}
            />
          </div>
        )}
      </main>

      <FloatingNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRecordClick={handleRecord}
      />

      {feedbackMsg && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="bg-blue-600/90 text-white px-8 py-4 rounded-2xl text-2xl font-black italic tracking-widest shadow-2xl animate-bounce">
            {feedbackMsg}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
