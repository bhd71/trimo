import React, { FC, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IApp, INotificationRule } from '../../../types/App.interface.ts';
import { Base64Image } from '../../../helpers/image-convert.tsx';
import { formatSeconds } from '../../../helpers/format-time.ts';
import { useAppData } from '../../../store/AppDataContext.tsx';

const MAX_NOTIF_HOURS = 23;
const MAX_NOTIF_MINUTES = 59;

interface IProps {
    app: IApp;
}

const NotificationSection: FC<IProps> = ({ app }) => {
    const { refreshNotifications } = useAppData();
    const [rule, setRule] = useState<INotificationRule | null>(null);
    const [editing, setEditing] = useState(false);
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const loadRule = async () => {
        const rules = await invoke<INotificationRule[]>('get_app_notifications');
        setRule(rules.find(r => r.app_name === app.app_name) ?? null);
    };

    useEffect(() => { loadRule(); }, [app.app_name]);

    const openForm = (existing?: INotificationRule) => {
        if (existing) {
            setHours(Math.floor(existing.threshold_seconds / 3600));
            setMinutes(Math.floor((existing.threshold_seconds % 3600) / 60));
            setMessage(existing.message);
        } else {
            setHours(0);
            setMinutes(30);
            setMessage('');
        }
        setEditing(true);
    };

    const handleSave = async () => {
        const threshold = hours * 3600 + minutes * 60;
        if (threshold <= 0) return;
        setSaving(true);
        const msg = message.trim() || `You've used ${app.app_name} for ${formatSeconds(threshold)}.`;
        await invoke('upsert_app_notification', {
            appName: app.app_name,
            thresholdSeconds: threshold,
            message: msg,
            enabled: true,
        });
        await loadRule();
        refreshNotifications();
        setEditing(false);
        setSaving(false);
    };

    const handleToggle = async () => {
        if (!rule) return;
        await invoke('upsert_app_notification', {
            appName: rule.app_name,
            thresholdSeconds: rule.threshold_seconds,
            message: rule.message,
            enabled: !rule.enabled,
        });
        await loadRule();
        refreshNotifications();
    };

    const handleDelete = async () => {
        await invoke('delete_app_notification', { appName: app.app_name });
        await loadRule();
        refreshNotifications();
    };

    return (
        <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-white/40">
                    <path d="M8 1a5 5 0 00-5 5v2.17l-.85.84A1 1 0 003 11h10a1 1 0 00.85-1.53L13 8.17V6a5 5 0 00-5-5zm0 14a2 2 0 01-1.95-1.6h3.9A2 2 0 018 15z"/>
                </svg>
                <span className="text-xs text-white/40 uppercase tracking-widest">Notification</span>
            </div>

            {rule && !editing ? (
                <div className={`flex items-start gap-3 rounded-xl px-3 py-3 border transition-colors ${
                    rule.enabled
                        ? 'bg-purple-500/10 border-purple-500/20'
                        : 'bg-white/[0.03] border-white/10 opacity-60'
                }`}>
                    <div className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden">
                        <Base64Image base64Data={app.logo_base64} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/90 truncate">{app.app_name}</p>
                        <p className="text-xs text-white/40 mt-0.5">after {formatSeconds(rule.threshold_seconds)}</p>
                        <p className="text-xs text-white/60 italic mt-1 truncate">&ldquo;{rule.message}&rdquo;</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        <button
                            onClick={handleToggle}
                            title={rule.enabled ? 'Disable' : 'Enable'}
                            className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${
                                rule.enabled ? 'bg-purple-600' : 'bg-white/10'
                            }`}
                        >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${
                                rule.enabled ? 'left-4' : 'left-0.5'
                            }`} />
                        </button>
                        <button
                            onClick={() => openForm(rule)}
                            className="text-white/20 hover:text-white/70 transition-colors text-xs leading-none"
                            aria-label="Edit"
                        >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M11.7 2.3a1 1 0 011.4 1.4L4.4 12.4l-2 .6.6-2 8.7-8.7z"/>
                            </svg>
                        </button>
                        <button
                            onClick={handleDelete}
                            className="text-white/20 hover:text-red-400 transition-colors text-sm leading-none"
                            aria-label="Delete"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            ) : editing ? (
                <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-3">
                    <div className="flex gap-2">
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-white/40">Hours</label>
                            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-purple-500/60 transition-colors">
                                <button type="button" onClick={() => setHours(h => Math.max(0, h - 1))}
                                    className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm leading-none select-none">−</button>
                                <input
                                    type="number" min={0} max={MAX_NOTIF_HOURS} value={hours}
                                    onChange={e => setHours(Math.min(MAX_NOTIF_HOURS, Math.max(0, Number(e.target.value))))}
                                    className="flex-1 min-w-0 bg-transparent text-center text-sm text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-1.5"
                                />
                                <button type="button" onClick={() => setHours(h => Math.min(MAX_NOTIF_HOURS, h + 1))}
                                    className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm leading-none select-none">+</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-xs text-white/40">Minutes</label>
                            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-purple-500/60 transition-colors">
                                <button type="button" onClick={() => setMinutes(m => Math.max(0, m - 1))}
                                    className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm leading-none select-none">−</button>
                                <input
                                    type="number" min={0} max={MAX_NOTIF_MINUTES} value={minutes}
                                    onChange={e => setMinutes(Math.min(MAX_NOTIF_MINUTES, Math.max(0, Number(e.target.value))))}
                                    className="flex-1 min-w-0 bg-transparent text-center text-sm text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-1.5"
                                />
                                <button type="button" onClick={() => setMinutes(m => Math.min(MAX_NOTIF_MINUTES, m + 1))}
                                    className="px-2.5 py-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors text-sm leading-none select-none">+</button>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-white/40">Message <span className="text-white/20">(optional)</span></label>
                        <input
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={`e.g. "Time to take a break!"`}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                        <button
                            onClick={() => setEditing(false)}
                            className="px-3 py-1.5 rounded-full text-xs text-white/40 hover:text-white/70 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || (hours === 0 && minutes === 0)}
                            className="px-4 py-1.5 rounded-full text-xs font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 hover:text-white transition-all duration-150 disabled:opacity-40"
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => openForm()}
                    className="flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-xs text-white/40 hover:text-white/80 border border-white/10 hover:border-white/20 transition-all duration-150"
                >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                        <path d="M8 1a1 1 0 011 1v5h5a1 1 0 010 2H9v5a1 1 0 01-2 0V9H2a1 1 0 010-2h5V2a1 1 0 011-1z"/>
                    </svg>
                    Add notification
                </button>
            )}
        </div>
    );
};

export default NotificationSection;
