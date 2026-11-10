import React from 'react';
import { cn } from '../../lib/utils';

export default function Layout({ children, className }) {
    return (
        <div className="app-viewport w-full bg-slate-100 flex justify-center items-start overflow-hidden font-sans text-slate-800">
            {/* Background Mesh Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/30 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-200/20 rounded-full blur-[100px]" />
            </div>

            {/* Main Container - Mobile Constrained */}
            <div className={cn(
                "app-shell relative z-10 w-full min-w-0 max-w-[480px] flex flex-col bg-white border-x border-slate-200 shadow-xl",
                "pb-32", // Space for floating footer
                className
            )}>
                {children}
            </div>
        </div>
    );
}
