import React, { FC } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { IMonitoringTrend } from '../../types/App.interface.ts';
import { formatSeconds, formatDateLabel, yAxisTick } from '../../helpers/format-time.ts';

interface IProps {
    data: IMonitoringTrend[];
}

const TrendChart: FC<IProps> = ({ data }) => {
    if (data.length === 0) return null;

    const chartData = data.map(d => ({
        date: d.date,
        label: formatDateLabel(d.date),
        value: d.total_seconds,
    }));

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-4">Daily screen time</p>
            <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="label"
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tickFormatter={yAxisTick}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                    />
                    <Tooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
                        formatter={(value) => [formatSeconds(Number(value)), 'Screen time']}
                        labelFormatter={(label) => label}
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
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fill="url(#trendGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#a855f7', stroke: 'rgba(168,85,247,0.3)', strokeWidth: 4 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TrendChart;
