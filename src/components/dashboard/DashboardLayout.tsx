import React, { FC, ReactNode, useEffect, useState } from 'react';
import TrackingStatus from './TrackingStatus.tsx';
import ActiveApps from './ActiveApps.tsx';
import Settings from '../settings/Settings.tsx';
import { useAppData } from '../../store/AppDataContext.tsx';
import { Period } from '../../store/AppDataContext.tsx';

interface IProps {
    isMonitoring: boolean;
    onToggle: () => void;
    children: ReactNode;
}

const DashboardLayout: FC<IProps> = ({ isMonitoring, onToggle, children }) => {
    const [showSettings, setShowSettings] = useState(false);
    const { setPeriod } = useAppData();

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
            <header className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-white tracking-tight">Trimo</h1>
                <div className="flex items-center gap-3">
                    <TrackingStatus
                        isMonitoring={isMonitoring}
                        onToggle={onToggle}
                    />
                    <button
                        onClick={() => setShowSettings(s => !s)}
                        aria-label="Settings"
                        className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 border active:scale-95 select-none ${
                            showSettings
                                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/70'
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
                        className="w-full max-w-md mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <Settings onClose={() => setShowSettings(false)} />
                    </div>
                </div>
            )}
            <ActiveApps />
            {children}
        </main>
    );
};

export default DashboardLayout;
