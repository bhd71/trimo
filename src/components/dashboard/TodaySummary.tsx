import React, { FC } from 'react';
import { IApp } from '../../types/App.interface.ts';
import { formatSeconds } from '../../helpers/format-time.ts';
import { Period } from '../../store/appStore.ts';

const PERIOD_LABELS: Record<Period, string> = {
    [Period.Today]:     'Total tracked today',
    [Period.Yesterday]: 'Total tracked yesterday',
    [Period.Week]:      'Total tracked this week',
    [Period.Month]:     'Total tracked this month',
};

interface IProps {
    apps: IApp[];
    monitoringSeconds: number;
    period: Period;
}

const TodaySummary: FC<IProps> = ({ apps, monitoringSeconds, period }) => {
    if (apps.length === 0) return null;

    const topApp = apps[0];

    return (
        <div className="flex gap-4">
            <div className="flex-1 bg-neutral-800 border border-white/5 shadow-sm rounded-2xl px-5 py-4">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2">{PERIOD_LABELS[period]}</p>
                <p className="text-3xl font-bold text-white">{formatSeconds(monitoringSeconds)}</p>
            </div>
            {topApp && (
                <div className="flex-1 bg-neutral-800 border border-white/5 shadow-sm rounded-2xl px-5 py-4">
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Most used</p>
                    <p className="text-2xl font-bold text-white">{topApp.app_name}</p>
                    <p className="text-sm text-white/40 mt-1">{topApp.formatted_duration}</p>
                </div>
            )}
        </div>
    );
};

export default TodaySummary;
