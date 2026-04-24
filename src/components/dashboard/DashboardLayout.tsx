import React, { FC, ReactNode, useEffect, useState } from 'react';
import TrackingStatus from './TrackingStatus.tsx';
import ActiveApps from './ActiveApps.tsx';
import Settings from '../settings/Settings.tsx';
import { useAppStore, Period } from '../../store/appStore.ts';

interface IProps {
    children: ReactNode;
}

const DashboardLayout: FC<IProps> = ({ children }) => {
    const [showSettings, setShowSettings] = useState(false);
    const setPeriod = useAppStore(s => s.setPeriod);
    const isIdle = useAppStore(s => s.isIdle);
    const goalJustReached = useAppStore(s => s.goalJustReached);
    const dismissGoalToast = useAppStore(s => s.dismissGoalToast);

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

            // Escape closes settings (modal handles its own Escape)
            if (e.key === 'Escape') {
                setShowSettings(false);
                return;
            }

            // Ctrl+F focuses search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                window.dispatchEvent(new Event('trimo:focus-search'));
                return;
            }

            // 1-4 switch period (only when not typing)
            if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.key === '1') { e.preventDefault(); setPeriod(Period.Today); }
                else if (e.key === '2') { e.preventDefault(); setPeriod(Period.Yesterday); }
                else if (e.key === '3') { e.preventDefault(); setPeriod(Period.Week); }
                else if (e.key === '4') { e.preventDefault(); setPeriod(Period.Month); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [setPeriod]);

    return (
        <main className="min-h-screen p-10 max-w-5xl mx-auto flex flex-col gap-8">
            <header className="flex items-center justify-between pb-6 border-b border-white/5">
                <h1 className="text-lg font-bold text-white tracking-tight">Trimo</h1>
                <div className="flex items-center gap-3">
                    <TrackingStatus />
                    <button
                        onClick={() => setShowSettings(s => !s)}
                        aria-label="Settings"
                        className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 border active:scale-95 select-none shadow-sm ${
                            showSettings
                                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30 shadow-md'
                                : 'bg-neutral-800 text-white/40 border-white/10 hover:shadow-md hover:border-white/20 hover:text-white/70'
                        }`}
                    >
                        ⚙
                    </button>
                </div>
            </header>
            {showSettings && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto modal-scroll"
                        onClick={e => e.stopPropagation()}
                    >
                        <Settings onClose={() => setShowSettings(false)} />
                    </div>
                </div>
            )}
            <ActiveApps />
            {goalJustReached && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-purple-600/20 border border-purple-500/30 backdrop-blur-sm shadow-lg shadow-purple-900/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span className="text-purple-300 text-lg">🎯</span>
                    <span className="text-sm text-white/80 font-medium">Daily screen time goal reached!</span>
                    <button
                        onClick={dismissGoalToast}
                        className="ml-2 text-white/30 hover:text-white/70 transition-colors text-base leading-none"
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            )}
            {children}
        </main>
    );
};

export default DashboardLayout;
