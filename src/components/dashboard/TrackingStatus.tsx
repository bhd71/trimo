import React, { FC } from 'react';

interface IProps {
    isMonitoring: boolean;
    onToggle: () => void;
}

const TrackingStatus: FC<IProps> = ({ isMonitoring, onToggle }) => {
    return (
        <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
                <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500 ${
                        isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-white/20'
                    }`}
                    style={isMonitoring ? { boxShadow: '0 0 6px rgba(74,222,128,0.8)' } : undefined}
                />
                <span className={`text-sm transition-all duration-300 ${
                    isMonitoring ? 'text-white/60' : 'text-white/25'
                }`}>
                    {isMonitoring ? 'Tracking' : 'Not tracking'}
                </span>
            </div>

            <span className="w-px h-4 bg-white/10" />

            {/* Button */}
            <button
                onClick={onToggle}
                aria-label={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
                className={`relative px-5 py-1.5 rounded-full text-sm font-semibold
                    transition-all duration-200 flex items-center gap-2 active:scale-95 select-none ${
                    isMonitoring
                        ? 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25'
                        : 'bg-gradient-to-r from-purple-700 to-purple-500 text-white border border-purple-400/30 hover:brightness-110'
                }`}
                style={isMonitoring
                    ? { boxShadow: '0 0 12px rgba(239,68,68,0.2)' }
                    : { boxShadow: '0 0 16px rgba(147,51,234,0.5), 0 0 32px rgba(147,51,234,0.15)' }
                }
            >
                {isMonitoring ? (
                    <>
                        <span className="w-2 h-2 rounded-sm bg-red-400 flex-shrink-0" />
                        Stop
                    </>
                ) : (
                    <>
                        <svg viewBox="0 0 10 12" className="w-2 h-2.5 fill-white flex-shrink-0">
                            <polygon points="0,0 10,6 0,12" />
                        </svg>
                        Start
                    </>
                )}
            </button>
        </div>
    );
};

export default TrackingStatus;
