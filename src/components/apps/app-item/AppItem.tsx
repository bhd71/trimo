import React, { FC, useState } from 'react';
import { AppLogo } from '../../../helpers/image-convert.tsx';
import { IApp } from '../../../types/App.interface.ts';
import { TruncatedText } from '../../../helpers/name-truncate.tsx';
import { useAppStore } from '../../../store/appStore.ts';
import { pctChange } from '../../../helpers/app-stats.ts';

const APP_NAME_MAX_LENGTH = 14;
const MIN_FILL_WIDTH_PERCENT = 3;
const MIN_SHARE_PERCENT_TO_DISPLAY = 1;

interface IProps {
    app: IApp;
    sharePercent: number;   // 0–100, % of total tracked time
    yesterdayDuration?: number;
    onClick?: () => void;
}

const AppItem: FC<IProps> = ({ app, sharePercent, yesterdayDuration, onClick }) => {
    const [pressed, setPressed] = useState(false);
    const notificationRules = useAppStore(s => s.notificationRules);
    const hasActiveAlert = notificationRules.some(r => r.app_name === app.app_name && r.enabled);
    const change = yesterdayDuration !== undefined ? pctChange(app.duration, yesterdayDuration) : null;
    const fillWidth = Math.max(sharePercent, MIN_FILL_WIDTH_PERCENT);

    return (
        <div
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => { const wasPressed = pressed; setPressed(false); if (wasPressed) onClick?.(); }}
            onMouseLeave={() => setPressed(false)}
            className={`group relative flex flex-col items-center gap-2 bg-[#282828] border border-white/10
                rounded-2xl px-4 pt-4 pb-5 w-full min-w-[120px] cursor-pointer overflow-hidden
                transition-all duration-150
                ${pressed ? 'scale-95 brightness-90' : ''}
            `}
        >
            {/* Background fill — grows left to right based on share of total time */}
            <div
                className="absolute inset-0 bg-purple-500/10 group-hover:bg-purple-500/[0.15] transition-all duration-700 ease-out rounded-2xl"
                style={{ width: `${fillWidth}%` }}
            />

            {/* Bell badge if an alert is active */}
            {hasActiveAlert && (
                <span className="absolute top-2 right-2 z-10 text-purple-400" title="Notification active">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                        <path d="M8 1a5 5 0 00-5 5v2.17l-.85.84A1 1 0 003 11h10a1 1 0 00.85-1.53L13 8.17V6a5 5 0 00-5-5zm0 14a2 2 0 01-1.95-1.6h3.9A2 2 0 018 15z"/>
                    </svg>
                </span>
            )}

            <AppLogo appName={app.app_name} />
            <span className="text-xs text-white/50 text-center w-full leading-tight relative">
                <TruncatedText text={app.app_name} maxLength={APP_NAME_MAX_LENGTH} />
            </span>
            <span className="text-base font-bold text-white relative">{app.formatted_duration}</span>
            {sharePercent >= MIN_SHARE_PERCENT_TO_DISPLAY && (
                <span className="text-xs text-white/30 relative">{Math.min(Math.round(sharePercent), 100)}%</span>
            )}
            {change && (
                <span className={`text-xs font-medium relative ${
                    change.startsWith('+') ? 'text-green-400' : 'text-red-400'
                }`}>
                    {change} vs yday
                </span>
            )}
        </div>
    );
};

export default AppItem;