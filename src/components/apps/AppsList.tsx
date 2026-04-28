import React, { useRef, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AppItem from './app-item/AppItem.tsx';

import PeriodSelector from './period-selector/PeriodSelector.tsx';
import { Period } from '../../store/appStore.ts';
import TodaySummary from '../dashboard/TodaySummary.tsx';
import GoalProgress from '../dashboard/GoalProgress.tsx';
import UsageChart from '../charts/UsageChart.tsx';
import TrendChart from '../charts/TrendChart.tsx';
import Select, { ISelectOption } from '../ui/Select.tsx';
import { useAppStore } from '../../store/appStore.ts';
import { useSettingsStore } from '../../store/settingsStore.ts';
import { IApp } from '../../types/App.interface.ts';
import { SortKey, sortApps } from '../../helpers/app-stats.ts';
import AppDetailsModal from './app-item/AppDetailsModal.tsx';

const SORT_OPTIONS: ISelectOption<SortKey>[] = [
    { label: 'Duration ↓', value: 'duration_desc' },
    { label: 'Duration ↑', value: 'duration_asc' },
    { label: 'Name A–Z',   value: 'name_asc' },
    { label: 'Name Z–A',   value: 'name_desc' },
    { label: '% Change',   value: 'pct_change' },
];

const AppsList = () => {
    const apps = useAppStore(s => s.apps);
    const yesterdayApps = useAppStore(s => s.yesterdayApps);
    const monitoringSeconds = useAppStore(s => s.monitoringSeconds);
    const totalSecondsToday = useAppStore(s => s.totalSecondsToday);
    const period = useAppStore(s => s.period);
    const setPeriod = useAppStore(s => s.setPeriod);
    const searchQuery = useAppStore(s => s.searchQuery);
    const setSearchQuery = useAppStore(s => s.setSearchQuery);
    const trendData = useAppStore(s => s.trendData);
    const dailyGoalSeconds = useSettingsStore(s => s.dailyGoalSeconds);
    const [selectedApp, setSelectedApp] = useState<IApp | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('duration_desc');
    const [showIgnored, setShowIgnored] = useState(false);
    const [ignoredApps, setIgnoredApps] = useState<IApp[]>([]);

    const loadIgnoredApps = useCallback(async () => {
        const data = await invoke<IApp[]>('get_ignored_apps');
        setIgnoredApps(data);
    }, []);

    useEffect(() => {
        if (showIgnored) loadIgnoredApps();
    }, [showIgnored, loadIgnoredApps]);

    const searchRef = useRef<HTMLInputElement>(null);

    const yesterdayMap = new Map(yesterdayApps.map(a => [a.app_name, a.duration]));
    const isToday = period === Period.Today;

    // Filter then sort
    const filtered = searchQuery.trim()
        ? apps.filter(a => a.app_name.toLowerCase().includes(searchQuery.toLowerCase()))
        : apps;
    const sorted = sortApps(filtered, sortKey, yesterdayMap);

    // Expose the search input ref for keyboard shortcut (Ctrl+F)
    // DashboardLayout will trigger focus via a custom event
    React.useEffect(() => {
        const handler = () => searchRef.current?.focus();
        window.addEventListener('trimo:focus-search', handler);
        return () => window.removeEventListener('trimo:focus-search', handler);
    }, []);

    return (
        <div className="flex flex-col gap-6">
            {/* Empty state / onboarding */}
            {apps.length === 0 && monitoringSeconds === 0 && (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-purple-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                        </svg>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-white/80 font-semibold text-base">Trimo is tracking your apps</p>
                        <p className="text-white/40 text-sm max-w-xs">
                            Usage data will appear here once you start using applications. Switch to another app and come back.
                        </p>
                    </div>
                </div>
            )}

            {apps.length > 0 && <TodaySummary apps={apps} monitoringSeconds={monitoringSeconds} period={period} />}
            {period === Period.Today && <GoalProgress totalSecondsToday={totalSecondsToday} dailyGoalSeconds={dailyGoalSeconds} />}

            {/* Period picker — above app cards */}
            <div className="flex flex-col gap-3">
                <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            {/* App cards — shown at the top */}
            {apps.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative flex-1 group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-white/70 text-sm pointer-events-none transition-colors duration-150">⌕</span>
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search apps…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-neutral-800 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-white/35 outline-none hover:border-white/20 focus:border-white/30 focus:ring-2 focus:ring-purple-500/25 transition-all duration-150"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors duration-150"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {/* Sort */}
                        <div className="shrink-0">
                            <Select<SortKey>
                                value={sortKey}
                                options={isToday ? SORT_OPTIONS : SORT_OPTIONS.filter(o => o.value !== 'pct_change')}
                                onChange={setSortKey}
                            />
                        </div>
                        {/* Ignored filter */}
                        <button
                            onClick={() => setShowIgnored(prev => !prev)}
                            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-150 ${
                                showIgnored
                                    ? 'bg-orange-500/20 text-orange-300 border-orange-400/30'
                                    : 'bg-neutral-800 text-white/40 border-white/10 hover:text-white/70 hover:border-white/20'
                            }`}
                        >
                            Ignored
                        </button>
                    </div>
                    {/* Ignored apps list */}
                    {showIgnored && (
                        ignoredApps.length === 0
                            ? <p className="text-white/30 text-sm text-center py-6">No ignored apps.</p>
                            : <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                                {ignoredApps.map(app => (
                                    <AppItem
                                        key={app.id}
                                        app={app}
                                        sharePercent={0}
                                        onClick={() => setSelectedApp(app)}
                                    />
                                ))}
                              </div>
                    )}

                    {/* Normal apps grid */}
                    {!showIgnored && (
                    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                        {sorted.map((app) => (
                            <AppItem
                                key={app.id}
                                app={app}
                                sharePercent={monitoringSeconds > 0 ? (app.duration / monitoringSeconds) * 100 : 0}
                                yesterdayDuration={isToday ? yesterdayMap.get(app.app_name) : undefined}
                                onClick={() => setSelectedApp(app)}
                            />
                        ))}
                    </div>
                    )}
                </div>
            )}

            {/* Dashboard section — charts */}

            <UsageChart apps={filtered} />
            <TrendChart data={trendData} />

            {selectedApp && (
                <AppDetailsModal app={selectedApp} onClose={() => { setSelectedApp(null); if (showIgnored) loadIgnoredApps(); }} />
            )}
        </div>
    );
};

export default AppsList;
