import React, { FC, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IApp, IAppDailyUsage } from '../../../types/App.interface.ts';
import ModalHeader from './ModalHeader.tsx';
import DailyUsageChart from './DailyUsageChart.tsx';
import DailyUsageTable from './DailyUsageTable.tsx';
import NotificationSection from './NotificationSection.tsx';
import { formatSeconds, formatDateLabel } from '../../../helpers/format-time.ts';

const WEEK_DAYS_BACK = 6;

interface IProps {
    app: IApp;
    onClose: () => void;
}

type Tab = 'week' | 'month';

const AppDetailsModal: FC<IProps> = ({ app, onClose }) => {
    const [rows, setRows] = useState<IAppDailyUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('week');
    const [activeDay, setActiveDay] = useState<string | null>(null);

    useEffect(() => {
        invoke<IAppDailyUsage[]>('get_app_daily_usage', { appName: app.app_name })
            .then(data => setRows(data))
            .finally(() => setLoading(false));
    }, [app.app_name]);

    const weekCutoff = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - WEEK_DAYS_BACK);
        return d.toISOString().slice(0, 10);
    }, []);

    const prevWeekCutoff = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - WEEK_DAYS_BACK - 7);
        return d.toISOString().slice(0, 10);
    }, []);

    const filtered = useMemo(
        () => tab === 'week' ? rows.filter(r => r.date >= weekCutoff) : rows,
        [rows, tab, weekCutoff],
    );

    const total = useMemo(() => filtered.reduce((s, r) => s + r.duration, 0), [filtered]);

    const peakRow = useMemo(
        () => filtered.length === 0 ? null : filtered.reduce((max, r) => r.duration > max.duration ? r : max, filtered[0]),
        [filtered],
    );

    const trend = useMemo(() => {
        if (tab !== 'week') return null;
        const prevRows = rows.filter(r => r.date >= prevWeekCutoff && r.date < weekCutoff);
        const prevTotal = prevRows.reduce((s, r) => s + r.duration, 0);
        if (prevTotal === 0) return null;
        return Math.round(((total - prevTotal) / prevTotal) * 100);
    }, [tab, rows, total, prevWeekCutoff, weekCutoff]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="modal-scroll relative w-[480px] max-h-[80vh] overflow-y-auto bg-neutral-900/95 backdrop-blur-md border border-white/10 shadow-xl rounded-2xl p-5 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                <ModalHeader appName={app.app_name} onClose={onClose} />

                {/* Insight strip */}
                {!loading && filtered.length > 0 && (
                    <div className="flex items-center gap-3 -mt-1 px-0.5">
                        <span className="text-white/70 text-sm font-medium">{formatSeconds(total)}</span>
                        {trend !== null && (
                            <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last week
                            </span>
                        )}
                        {peakRow && (
                            <span className="text-xs text-white/35 ml-auto">
                                Peak: {formatDateLabel(peakRow.date)} ({peakRow.formatted_duration})
                            </span>
                        )}
                    </div>
                )}

                {/* Tab switcher */}
                <div className="flex gap-1">
                    {(['week', 'month'] as Tab[]).map(t => {
                        const isActive = tab === t;
                        return (
                            <button
                                key={t}
                                onClick={() => { setTab(t); setActiveDay(null); }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                                    isActive
                                        ? 'bg-purple-500/20 text-white border-purple-400/30'
                                        : 'bg-transparent text-white/40 border-transparent hover:text-white/70 hover:border-white/10'
                                }`}
                            >
                                {t === 'week' ? 'This Week' : 'This Month'}
                            </button>
                        );
                    })}
                </div>

                {loading && (
                    <p className="text-white/40 text-sm text-center py-8">Loading…</p>
                )}

                {!loading && filtered.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-8">No usage data for this period.</p>
                )}

                {!loading && filtered.length > 0 && (
                    <>
                        <DailyUsageChart
                            rows={filtered}
                            activeDay={activeDay}
                            onHover={setActiveDay}
                        />
                        <DailyUsageTable
                            rows={filtered}
                            total={total}
                            activeDay={activeDay}
                            onHoverDay={setActiveDay}
                        />
                    </>
                )}

                <NotificationSection app={app} />
            </div>
        </div>
    );
};

export default AppDetailsModal;
