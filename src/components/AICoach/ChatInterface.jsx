import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Zap, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ChatInterface({ messages, isTalking, onSendMessage, userName }) {
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);

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
        <div className="flex flex-col gap-4">
            {/* Avatar & Status Area */}
            <div className="flex items-center gap-4 px-2">
                <motion.div
                    animate={{
                        scale: isTalking ? [1, 1.1, 1] : 1,
                        boxShadow: isTalking
                            ? "0 0 20px rgba(255, 215, 0, 0.6)"
                            : "0 0 0px rgba(0,0,0,0)"
                    }}
                    transition={{ duration: 0.5, repeat: isTalking ? Infinity : 0 }}
                    className="w-16 h-16 rounded-full border-2 border-yellow-500 overflow-hidden relative shadow-lg shadow-yellow-500/20 bg-yellow-500"
                >
                    <img
                        src="https://ui-avatars.com/api/?name=All+Might&background=facc15&color=fff&size=128"
                        alt="All Might"
                        className="w-full h-full object-cover"
                    />
                    {isTalking && (
                        <div className="absolute inset-0 bg-yellow-500/30 animate-pulse" />
                    )}
                </motion.div>

                <div className="flex-1">
                    <h3 className="text-sm font-bold text-yellow-500 flex items-center gap-2">
                        ALL MIGHT <span className="text-[10px] text-gray-500 border border-gray-700 px-1 rounded">AI COACH</span>
                    </h3>
                    <p className="text-xs text-gray-400">
                        {isTalking ? "生成中..." : "待機中"}
                    </p>
                </div>
            </div>

            {/* Chat Area - Compact */}
            <div
                ref={scrollRef}
                className="h-40 overflow-y-auto glass rounded-xl p-4 space-y-3 no-scrollbar mask-fade-top"
            >
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "max-w-[85%] text-xs p-3 rounded-2xl leading-relaxed",
                                msg.role === 'ai'
                                    ? "bg-blue-600/20 text-blue-100 rounded-tl-none border border-blue-500/30"
                                    : "bg-white/10 text-white rounded-tr-none ml-auto border border-white/10"
                            )}
                        >
                            {msg.text}
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
                    placeholder="質問を入力..."
                    className="w-full bg-black/50 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-full text-white disabled:opacity-50 disabled:bg-gray-700 transition-all hover:scale-105"
                >
                    <Send size={14} />
                </button>
            </form>
        </div>
    );
}
