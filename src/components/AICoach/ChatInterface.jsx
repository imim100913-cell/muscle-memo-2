/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const COACH_META = {
    'all-might': {
        name: '熱血コーチ',
        role: 'AI POWER COACH',
        avatar: './coach_all_might.png',
        borderColor: 'border-amber-500',
        glowColor: '0 0 12px rgba(245, 158, 11, 0.4)',
        shadowColor: 'shadow-amber-500/10 bg-amber-500',
        nameColor: 'text-amber-700 font-extrabold',
        bubbleBg: 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-none font-medium',
        pulseBg: 'bg-amber-500/20'
    },
    'demon': {
        name: 'スパルタ鬼コーチ',
        role: 'AI STRICT COACH',
        avatar: './coach_demon.png',
        borderColor: 'border-red-600',
        glowColor: '0 0 12px rgba(220, 38, 38, 0.4)',
        shadowColor: 'shadow-red-500/10 bg-red-600',
        nameColor: 'text-red-700 font-extrabold',
        bubbleBg: 'bg-red-50 text-red-950 border border-red-200 rounded-tl-none font-medium',
        pulseBg: 'bg-red-600/20'
    },
    'gentle': {
        name: '癒やし系コーチ',
        role: 'AI GENTLE COACH',
        avatar: './coach_gentle.png',
        borderColor: 'border-green-500',
        glowColor: '0 0 12px rgba(22, 163, 74, 0.4)',
        shadowColor: 'shadow-green-500/10 bg-green-500',
        nameColor: 'text-green-700 font-extrabold',
        bubbleBg: 'bg-green-50 text-green-950 border border-green-200 rounded-tl-none font-medium',
        pulseBg: 'bg-green-500/20'
    },
    'professional': {
        name: '論理派コーチ',
        role: 'AI DATA COACH',
        avatar: './coach_professional.png',
        borderColor: 'border-cyan-600',
        glowColor: '0 0 12px rgba(8, 145, 178, 0.4)',
        shadowColor: 'shadow-cyan-500/10 bg-cyan-600',
        nameColor: 'text-cyan-700 font-extrabold',
        bubbleBg: 'bg-cyan-50 text-cyan-950 border border-cyan-200 rounded-tl-none font-medium',
        pulseBg: 'bg-cyan-600/20'
    }
};

export default function ChatInterface({ messages, isTalking, onSendMessage, coachType = 'all-might', isModal = false, onClose }) {
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);

    const coach = COACH_META[coachType] || COACH_META['all-might'];

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className={cn("flex flex-col gap-4", isModal ? "h-full" : "")}>
            {/* Avatar & Status Area */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <motion.div
                        animate={{
                            scale: isTalking ? [1, 1.08, 1] : 1,
                            boxShadow: isTalking ? coach.glowColor : "0 0 0px rgba(0,0,0,0)"
                        }}
                        transition={{ duration: 0.6, repeat: isTalking ? Infinity : 0, ease: "easeInOut" }}
                        className={cn(
                            "w-14 h-14 rounded-full border-2 overflow-hidden relative shadow-md flex-shrink-0",
                            coach.borderColor,
                            coach.shadowColor
                        )}
                    >
                        <img
                            src={coach.avatar}
                            alt={coach.name}
                            className="w-full h-full object-cover"
                        />
                        {isTalking && (
                            <div className={cn("absolute inset-0 animate-pulse", coach.pulseBg)} />
                        )}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                        <h3 className={cn("text-sm font-bold flex items-center gap-2", coach.nameColor)}>
                            {coach.name} <span className="text-[9px] text-slate-500 border border-slate-200 px-1 py-0.5 rounded leading-none">{coach.role}</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isTalking ? "考え中..." : "待機中（メッセージを送ってみよう）"}
                        </p>
                    </div>
                </div>

                {isModal && onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all outline-none"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Chat Area - Dynamic height */}
            <div
                ref={scrollRef}
                className={cn(
                    "overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 no-scrollbar shadow-inner",
                    isModal ? "h-[320px]" : "h-44"
                )}
            >
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "max-w-[85%] text-xs p-3 rounded-2xl leading-relaxed whitespace-pre-wrap shadow-sm",
                                msg.role === 'ai'
                                    ? coach.bubbleBg
                                    : "bg-blue-600 text-white rounded-tr-none ml-auto"
                            )}
                        >
                            {msg.text}
                            {msg.error && (
                                <div className="mt-2.5 p-3 rounded-xl border border-red-200 bg-red-50 text-[11px] text-red-900 space-y-2 animate-fade-in">
                                    <div className="flex items-center gap-1.5 font-bold text-red-700">
                                        <AlertTriangle size={13} />
                                        {msg.error.title}
                                    </div>
                                    <p className="leading-relaxed opacity-95 text-slate-700">{msg.error.description}</p>
                                    {msg.error.solutions && (
                                        <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
                                            <span className="font-bold text-slate-800 block text-[10px]">推奨解決手順:</span>
                                            <ul className="list-disc list-inside space-y-1 text-slate-600 font-medium">
                                                {msg.error.solutions.map((s, idx) => (
                                                    <li key={idx} className="leading-normal">{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="relative group">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`${coach.name}に質問する...`}
                    className="w-full bg-white border border-slate-200 rounded-full py-3.5 pl-5 pr-12 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-full text-white disabled:opacity-30 disabled:bg-slate-100 disabled:text-slate-400 transition-all hover:scale-105 active:scale-95 outline-none"
                >
                    <Send size={14} />
                </button>
            </form>
            {input.length > 50 && (
                <div className="text-right px-4 pt-1">
                    <span className={`text-[9px] font-mono font-medium ${input.length > 300 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {input.length}文字
                    </span>
                </div>
            )}
        </div>
    );
}
