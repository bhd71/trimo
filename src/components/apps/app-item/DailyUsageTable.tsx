import React, { FC } from 'react';
import { IAppDailyUsage } from '../../../types/App.interface.ts';
import { formatSeconds, formatDateLabel } from '../../../helpers/format-time.ts';

interface IProps {
    rows: IAppDailyUsage[];
    total: number;
    activeDay?: string | null;
    onHoverDay?: (day: string | null) => void;
}

const DailyUsageTable: FC<IProps> = ({ rows, total, activeDay, onHoverDay }) => (
    <div className="flex flex-col gap-1">
        <div className="grid grid-cols-2 text-xs text-white/30 uppercase tracking-widest px-3 pb-1">
            <span>Date</span>
            <span className="text-right">Duration</span>
        </div>
        {rows.map(r => {
            const isActive = activeDay === r.date;
            return (
                <div
                    key={r.date}
                    onMouseEnter={() => onHoverDay?.(r.date)}
                    onMouseLeave={() => onHoverDay?.(null)}
                    className={`grid grid-cols-2 text-sm rounded-lg px-3 py-2 border transition-all duration-150 cursor-default ${
                        isActive
                            ? 'bg-purple-500/10 border-purple-400/20 text-white'
                            : 'bg-neutral-800/60 border-white/5 text-white/80 hover:bg-neutral-800 hover:border-white/10'
                    }`}
                >
                    <span>{formatDateLabel(r.date)}</span>
                    <span className={`text-right ${
                        isActive ? 'text-purple-300 font-medium' : 'text-white/50'
                    }`}>{r.formatted_duration}</span>
                </div>
            );
        })}
        <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-white/10 px-3">
            <span className="text-sm text-white/50">Total</span>
            <span className="text-base font-semibold text-white">{formatSeconds(total)}</span>
        </div>
    </div>
);

export default DailyUsageTable;
