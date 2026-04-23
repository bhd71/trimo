import React, { FC, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { INotificationRule } from '../../types/App.interface.ts';
import { useAppStore } from '../../store/appStore.ts';
import { formatSeconds } from '../../helpers/format-time.ts';

const AppNotifications: FC = () => {
    const apps = useAppStore(s => s.apps);
    const [rules, setRules] = useState<INotificationRule[]>([]);

    // Add-rule form state
    const [appName, setAppName] = useState('');
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [message, setMessage] = useState('');
    const [adding, setAdding] = useState(false);
    const [formError, setFormError] = useState('');

    const datalistId = 'notification-app-names';
    const inputRef = useRef<HTMLInputElement>(null);

    const load = () =>
        invoke<INotificationRule[]>('get_app_notifications').then(setRules);

    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        const name = appName.trim();
        if (!name) { setFormError('App name is required.'); return; }
        const threshold = hours * 3600 + minutes * 60;
        if (threshold <= 0) { setFormError('Set at least 1 minute.'); return; }
        const msg = message.trim() || `You've used ${name} for ${formatSeconds(threshold)}.`;

        setAdding(true);
        setFormError('');
        try {
            await invoke('upsert_app_notification', {
                appName: name,
                thresholdSeconds: threshold,
                message: msg,
                enabled: true,
            });
            setAppName('');
            setHours(0);
            setMinutes(0);
            setMessage('');
            await load();
        } finally {
            setAdding(false);
        }
    };

    const handleToggle = async (rule: INotificationRule) => {
        await invoke('upsert_app_notification', {
            appName: rule.app_name,
            thresholdSeconds: rule.threshold_seconds,
            message: rule.message,
            enabled: !rule.enabled,
        });
        await load();
    };

    const handleDelete = async (appName: string) => {
        await invoke('delete_app_notification', { appName });
        await load();
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="text-xs text-white/40 uppercase tracking-widest">App Notifications</p>

            {/* Existing rules */}
            {rules.length > 0 && (
                <div className="flex flex-col gap-2">
                    {rules.map(rule => (
                        <div
                            key={rule.app_name}
                            className="flex items-start gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{rule.app_name}</p>
                                <p className="text-xs text-white/40 mt-0.5">
                                    after {formatSeconds(rule.threshold_seconds)}
                                </p>
                                <p className="text-xs text-white/60 mt-0.5 italic truncate">&ldquo;{rule.message}&rdquo;</p>
                            </div>
                            {/* Toggle */}
                            <button
                                onClick={() => handleToggle(rule)}
                                title={rule.enabled ? 'Disable' : 'Enable'}
                                className={`mt-0.5 w-8 h-4 rounded-full flex-shrink-0 relative transition-colors duration-200 ${
                                    rule.enabled ? 'bg-purple-600' : 'bg-white/10'
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${
                                        rule.enabled ? 'left-4' : 'left-0.5'
                                    }`}
                                />
                            </button>
                            {/* Delete */}
                            <button
                                onClick={() => handleDelete(rule.app_name)}
                                className="mt-0.5 text-white/20 hover:text-red-400 transition-colors text-sm leading-none flex-shrink-0"
                                aria-label="Delete rule"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add-rule form */}
            <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-3">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Add alert</p>

                {/* App name */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">App name</label>
                    <input
                        ref={inputRef}
                        list={datalistId}
                        value={appName}
                        onChange={e => { setAppName(e.target.value); setFormError(''); }}
                        placeholder="e.g. Discord"
                        className="bg-[#3a3a3a] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors"
                    />
                    <datalist id={datalistId}>
                        {apps.map(a => <option key={a.app_name} value={a.app_name} />)}
                    </datalist>
                </div>

                {/* Duration */}
                <div className="flex gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs text-white/40">Hours</label>
                        <input
                            type="number"
                            min={0}
                            max={23}
                            value={hours}
                            onChange={e => { setHours(Math.max(0, Number(e.target.value))); setFormError(''); }}
                            className="bg-[#3a3a3a] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/60 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs text-white/40">Minutes</label>
                        <input
                            type="number"
                            min={0}
                            max={59}
                            value={minutes}
                            onChange={e => { setMinutes(Math.max(0, Number(e.target.value))); setFormError(''); }}
                            className="bg-[#3a3a3a] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500/60 transition-colors"
                        />
                    </div>
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40">Notification message <span className="text-white/20">(optional)</span></label>
                    <input
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder='e.g. "Time to take a break!"'
                        className="bg-[#3a3a3a] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors"
                    />
                </div>

                {formError && <p className="text-xs text-red-400">{formError}</p>}

                <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="mt-1 self-end px-4 py-1.5 rounded-full text-sm font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 hover:text-white transition-all duration-150 disabled:opacity-50"
                >
                    {adding ? 'Adding…' : 'Add Alert'}
                </button>
            </div>
        </div>
    );
};

export default AppNotifications;
