import React, { useMemo } from 'react';
import { cn, getSessionStatus } from '../../lib/utils';
import { Sparkles, Zap } from 'lucide-react';

export default function AICoach({ lastLogTimestamp, recentPR }) {
    const status = useMemo(() => getSessionStatus(lastLogTimestamp), [lastLogTimestamp]);

    const message = useMemo(() => {
        if (recentPR) return "素晴らしい！！ 昨日の自分を超えたな！ それこそがヒーローの本質だ！ PLUS ULTRA！！";
        if (status === 'active') return "休む暇はないぞ少年！ 次のセットが君を待っている！";
        return "私が来た！ さあ、今日の限界を超えに行こうか！ 準備はいいかい？";
    }, [status, recentPR]);

    return (
        <div className="relative w-full mb-6 group">
            {/* Aurora Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-red-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 animate-pulse"></div>

            <div className="relative glass-card border-l-4 border-l-yellow-400 flex items-start gap-4 overflow-hidden">
                {/* Avatar Area */}
                <div className="flex-shrink-0 relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20 border-2 border-white/20">
                        <Zap className="text-white fill-white" size={32} />
                    </div>
                    {status === 'active' && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                            <Sparkles size={12} className="text-white animate-spin-slow" />
                        </div>
                    )}
                </div>

                {/* Text Area */}
                <div className="flex-1">
                    <h3 className="text-xs font-bold text-yellow-500 tracking-wider uppercase mb-1 flex items-center gap-2">
                        Demon Coach <span className="text-white/30">|</span> All My-ght
                    </h3>
                    <p className="text-sm text-gray-200 leading-relaxed font-medium">
                        「{message}」
                    </p>
                </div>
            </div>
        </div>
    );
}
