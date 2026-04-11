import React, { createContext, FC, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IApp, IMonitoringTrend, INotificationRule } from '../types/App.interface.ts';

export enum Period {
    Today     = 'today',
    Yesterday = 'yesterday',
    Week      = 'week',
    Month     = 'month',
}

interface IAppDataContext {
    apps: IApp[];
    yesterdayApps: IApp[];
    monitoringSeconds: number;
    totalSecondsToday: number;
    activeApps: string[];
    period: Period;
    setPeriod: (p: Period) => void;
    monitoringInterval: number;
    updateMonitoringInterval: (seconds: number) => Promise<void>;
    notificationRules: INotificationRule[];
    refreshNotifications: () => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    trendData: IMonitoringTrend[];
}

const AppDataContext = createContext<IAppDataContext | null>(null);

export const AppDataProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [apps, setApps] = useState<IApp[]>([]);
    const [yesterdayApps, setYesterdayApps] = useState<IApp[]>([]);
    const [monitoringSeconds, setMonitoringSeconds] = useState(0);
    const [totalSecondsToday, setTotalSecondsToday] = useState(0);
    const [activeApps, setActiveApps] = useState<string[]>([]);
    const [period, setPeriod] = useState<Period>(Period.Today);
    const [monitoringInterval, setMonitoringInterval] = useState(1);
    const [notificationRules, setNotificationRules] = useState<INotificationRule[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [trendData, setTrendData] = useState<IMonitoringTrend[]>([]);
    const [windowVisible, setWindowVisible] = useState(true);
    const periodRef = useRef(period);
    useEffect(() => { periodRef.current = period; }, [period]);

    const refreshNotifications = useCallback(() => {
        invoke<INotificationRule[]>('get_app_notifications').then(setNotificationRules);
    }, []);

    useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

    // Read saved interval preference on mount
    useEffect(() => {
        invoke<string | null>('get_preference', { key: 'monitoring_interval' }).then(val => {
            if (val) setMonitoringInterval(Number(val));
        });
    }, []);

    const fetchAll = useCallback(async (p: Period) => {
        const [appRecords, yesterdayRecords, total, totalToday, active, trend] = await Promise.all([
            invoke<IApp[]>('get_app_usage_stats', { period: p }),
            invoke<IApp[]>('get_app_usage_stats', { period: Period.Yesterday }),
            invoke<number>('get_total_monitoring_time', { period: p }),
            invoke<number>('get_total_monitoring_time', { period: Period.Today }),
            invoke<string[]>('list_opened_apps'),
            invoke<IMonitoringTrend[]>('get_monitoring_trend', { period: p === Period.Month ? 'month' : 'week' }),
        ]);
        setApps(appRecords);
        setYesterdayApps(yesterdayRecords);
        setMonitoringSeconds(total);
        setTotalSecondsToday(totalToday);
        setActiveApps(active);
        setTrendData(trend);
    }, []);

    // Subscribe to window visibility — pause polling when hidden
    useEffect(() => {
        const handler = () => {
            const visible = document.visibilityState === 'visible';
            setWindowVisible(visible);
            if (visible) fetchAll(periodRef.current);
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [fetchAll]);

    // Single polling loop — paused when window is hidden
    useEffect(() => {
        if (!windowVisible) return;
        fetchAll(period);
        const id = setInterval(() => fetchAll(period), monitoringInterval * 1000);
        return () => clearInterval(id);
    }, [period, monitoringInterval, fetchAll, windowVisible]);

    const updateMonitoringInterval = async (seconds: number) => {
        await invoke('apply_monitoring_interval', { intervalSeconds: seconds });
        setMonitoringInterval(seconds);
    };

    return (
        <AppDataContext.Provider value={{
            apps,
            yesterdayApps,
            monitoringSeconds,
            totalSecondsToday,
            activeApps,
            period,
            setPeriod,
            monitoringInterval,
            updateMonitoringInterval,
            notificationRules,
            refreshNotifications,
            searchQuery,
            setSearchQuery,
            trendData,
        }}>
            {children}
        </AppDataContext.Provider>
    );
};

export function useAppData(): IAppDataContext {
    const ctx = useContext(AppDataContext);
    if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
    return ctx;
}
