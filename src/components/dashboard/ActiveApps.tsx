import React, { FC } from 'react';
import { useAppData } from '../../store/AppDataContext.tsx';

const ActiveApps: FC = () => {
    const { activeApps: apps } = useAppData();

    if (apps.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-white/40 uppercase tracking-widest">
                Active now · {apps.length} apps
            </p>
            <div className="flex flex-wrap gap-2">
                {apps.map(name => (
                    <span
                        key={name}
                        className="relative flex items-center gap-2 px-3 py-1 rounded-full bg-green-400/5 border border-green-400/20 text-sm text-white/80"
                        style={{ boxShadow: '0 0 10px rgba(74,222,128,0.08)' }}
                    >
                        {/* Dot with two staggered ripple rings */}
                        <span className="relative flex items-center justify-center shrink-0 w-2 h-2">
                            <span
                                className="absolute w-2 h-2 rounded-full bg-green-400/30"
                                style={{ animation: 'trimo-ring 1.8s ease-out infinite' }}
                            />
                            <span
                                className="absolute w-2 h-2 rounded-full bg-green-400/20"
                                style={{ animation: 'trimo-ring 1.8s ease-out infinite', animationDelay: '0.6s' }}
                            />
                            <span
                                className="w-2 h-2 rounded-full bg-green-400"
                                style={{ boxShadow: '0 0 6px rgba(74,222,128,1), 0 0 12px rgba(74,222,128,0.5)' }}
                            />
                        </span>
                        {name}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default ActiveApps;
