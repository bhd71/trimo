import React, { FC } from 'react';
import { formatSeconds } from '../../helpers/format-time.ts';

interface IProps {
    totalSecondsToday: number;
    dailyGoalSeconds: number;
}

const GoalProgress: FC<IProps> = ({ totalSecondsToday, dailyGoalSeconds }) => {
    if (dailyGoalSeconds <= 0) return null;

    const pct = Math.min(100, Math.round((totalSecondsToday / dailyGoalSeconds) * 100));
    const exceeded = totalSecondsToday >= dailyGoalSeconds;

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-white/40 uppercase tracking-widest">Daily goal</p>
                <p className={`text-xs font-semibold ${exceeded ? 'text-red-400' : 'text-white/60'}`}>
                    {formatSeconds(totalSecondsToday)} / {formatSeconds(dailyGoalSeconds)}
                </p>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${
                        exceeded ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-purple-500'
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            {exceeded && (
                <p className="text-xs text-red-400/80">Daily goal reached — take a break!</p>
            )}
        </div>
    );
};

export default GoalProgress;
