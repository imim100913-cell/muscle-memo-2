import React from 'react';
import { cn } from '../../lib/utils';

export default function Layout({ children, className }) {
    return (
        <div className="min-h-screen w-full bg-black flex justify-center items-start overflow-hidden font-sans text-stone-200">
            {/* Background Mesh Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[100px]" />
            </div>

            {/* Main Container - Mobile Constrained */}
            <div className={cn(
                "relative z-10 w-full max-w-[480px] min-h-screen flex flex-col glass border-x border-white/5",
                "pb-32", // Space for floating footer
                className
            )}>
                {children}
            </div>
        </div>
    );
}
