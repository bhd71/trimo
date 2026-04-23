import React, { FC } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { IAppDailyUsage } from '../../../types/App.interface.ts';
import { formatSeconds, yAxisTick, formatDateLabel } from '../../../helpers/format-time.ts';

interface IProps {
    rows: IAppDailyUsage[];
    activeDay?: string | null;
    onHover?: (day: string | null) => void;
}

const DailyUsageChart: FC<IProps> = ({ rows, activeDay, onHover }) => {
    const data = rows.map(r => ({
        name: formatDateLabel(r.date),
        date: r.date,
        value: r.duration,
    }));

    return (
        <div className="px-1 py-2">
            <ResponsiveContainer width="100%" height={160}>
                <BarChart
                    data={data}
                    margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                    barCategoryGap="30%"
                    onMouseLeave={() => onHover?.(null)}
                >
                    <XAxis
                        dataKey="name"
                        tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 6) + '…' : v}
                    />
                    <YAxis
                        tickFormatter={yAxisTick}
                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={(value) => [formatSeconds(Number(value)), 'Usage']}
                        contentStyle={{
                            background: '#1a1a2e',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '13px',
                        }}
                        itemStyle={{ color: 'rgba(255,255,255,0.85)' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                    />
                    <Bar
                        dataKey="value"
                        radius={[4, 4, 0, 0]}
                        onMouseEnter={(_: unknown, index: number) => onHover?.(data[index].date)}
                    >
                        {data.map(entry => {
                            const isHighlighted = activeDay === entry.date;
                            const isDimmed = activeDay !== null && activeDay !== entry.date;
                            return (
                                <Cell
                                    key={entry.date}
                                    fill={
                                        isHighlighted
                                            ? '#a855f7'
                                            : isDimmed
                                            ? 'rgba(168,85,247,0.2)'
                                            : 'rgba(168,85,247,0.5)'
                                    }
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DailyUsageChart;
