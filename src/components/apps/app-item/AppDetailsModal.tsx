import React, { FC, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IApp, IAppDailyUsage } from '../../../types/App.interface.ts';
import ModalHeader from './ModalHeader.tsx';
import DailyUsageChart from './DailyUsageChart.tsx';
import DailyUsageTable from './DailyUsageTable.tsx';
import NotificationSection from './NotificationSection.tsx';

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

    const filtered = useMemo(
        () => tab === 'week' ? rows.filter(r => r.date >= weekCutoff) : rows,
        [rows, tab, weekCutoff],
    );

    const total = useMemo(() => filtered.reduce((s, r) => s + r.duration, 0), [filtered]);

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
                className="modal-scroll relative w-[480px] max-h-[80vh] overflow-y-auto bg-[#0f0f1a] border border-white/10 rounded-2xl p-5 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                <ModalHeader appName={app.app_name} onClose={onClose} />

                {/* Tab switcher */}
                <div className="flex gap-2">
                    {(['week', 'month'] as Tab[]).map(t => {
                        const isActive = tab === t;
                        return (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                style={isActive ? { boxShadow: '0 0 12px rgba(147,51,234,0.8), 0 0 28px rgba(147,51,234,0.4)' } : undefined}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-white/10 text-white'
                                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
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
                        <DailyUsageChart rows={filtered} />
                        <DailyUsageTable rows={filtered} total={total} />
                    </>
                )}

                <NotificationSection app={app} />
            </div>
        </div>
    );
};

export default AppDetailsModal;
