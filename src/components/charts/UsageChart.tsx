import React, { FC } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { IApp } from '../../types/App.interface.ts';
import { formatSeconds, yAxisTick } from '../../helpers/format-time.ts';

const MAX_CHART_APPS = 12;

interface IProps {
    apps: IApp[];
}

const UsageChart: FC<IProps> = ({ apps }) => {
    const data = apps.slice(0, MAX_CHART_APPS).map((app, i) => ({
        name: app.app_name,
        value: app.duration,
        fill: i === 0 ? '#a855f7' : 'rgba(168,85,247,0.45)',
    }));

    if (data.length === 0) return null;

    return (
        <div className="bg-neutral-800 border border-white/5 shadow-sm rounded-2xl px-5 py-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-4">App usage</p>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="30%">
                    <XAxis
                        dataKey="name"
                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v}
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

export default UsageChart;
