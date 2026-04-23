import React, { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { IAppDailyUsage } from '../../../types/App.interface.ts';
import { formatSeconds, yAxisTick, formatDateLabel } from '../../../helpers/format-time.ts';

interface IProps {
    rows: IAppDailyUsage[];
}

const DailyUsageChart: FC<IProps> = ({ rows }) => {
    const data = rows.map((r, i) => ({
        name: formatDateLabel(r.date),
        value: r.duration,
        fill: i === rows.length - 1 ? '#a855f7' : 'rgba(168,85,247,0.45)',
    }));

    return (
        <div className="bg-neutral-800 border border-white/5 rounded-xl px-4 py-3">
            <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="30%">
                    <XAxis
                        dataKey="name"
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 6) + '…' : v}
                    />
                    <YAxis
                        tickFormatter={yAxisTick}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        formatter={(value) => [formatSeconds(Number(value)), 'Usage']}
                        contentStyle={{
                            background: '#0f0f1a',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '13px',
                        }}
                        itemStyle={{ color: 'rgba(255,255,255,0.85)' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DailyUsageChart;
