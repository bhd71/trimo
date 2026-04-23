import React, { FC } from 'react';
import { IAppDailyUsage } from '../../../types/App.interface.ts';
import { formatSeconds, formatDateLabel } from '../../../helpers/format-time.ts';

interface IProps {
    rows: IAppDailyUsage[];
    total: number;
}

const DailyUsageTable: FC<IProps> = ({ rows, total }) => (
    <div className="flex flex-col gap-1">
        <div className="grid grid-cols-2 text-xs text-white/30 uppercase tracking-widest px-2 pb-1">
            <span>Date</span>
            <span className="text-right">Duration</span>
        </div>
        {rows.map(r => (
            <div
                key={r.date}
                className="grid grid-cols-2 text-sm text-white/80 bg-neutral-800 hover:bg-neutral-700 rounded-lg px-2 py-1.5 border border-white/5 transition-colors"
            >
                <span>{formatDateLabel(r.date)}</span>
                <span className="text-right text-white/60">{r.formatted_duration}</span>
            </div>
        ))}
        <div className="grid grid-cols-2 text-sm font-bold text-white border-t border-white/10 mt-1 pt-2 px-2">
            <span>Total</span>
            <span className="text-right">{formatSeconds(total)}</span>
        </div>
    </div>
);

export default DailyUsageTable;
