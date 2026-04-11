import React, { useRef, useState } from 'react';
import AppItem from './app-item/AppItem.tsx';

import PeriodSelector, { Period } from './period-selector/PeriodSelector.tsx';
import TodaySummary from '../dashboard/TodaySummary.tsx';
import UsageChart from '../charts/UsageChart.tsx';
import TrendChart from '../charts/TrendChart.tsx';
import Select, { ISelectOption } from '../ui/Select.tsx';
import { useAppData } from '../../store/AppDataContext.tsx';
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
    const { apps, yesterdayApps, monitoringSeconds, period, setPeriod, searchQuery, setSearchQuery, trendData } = useAppData();
    const [selectedApp, setSelectedApp] = useState<IApp | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('duration_desc');
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
            {apps.length > 0 && <TodaySummary apps={apps} monitoringSeconds={monitoringSeconds} period={period} />}
            <UsageChart apps={filtered} />
            <TrendChart data={trendData} />
            <div className="flex flex-col gap-3">
                <PeriodSelector value={period} onChange={setPeriod} />
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">⌕</span>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search apps…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {/* Sort */}
                    <div className="w-36 shrink-0">
                        <Select<SortKey>
                            value={sortKey}
                            options={isToday ? SORT_OPTIONS : SORT_OPTIONS.filter(o => o.value !== 'pct_change')}
                            onChange={setSortKey}
                        />
                    </div>
                </div>
            </div>
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
            {selectedApp && (
                <AppDetailsModal app={selectedApp} onClose={() => setSelectedApp(null)} />
            )}
        </div>
    );
};

export default AppsList;
