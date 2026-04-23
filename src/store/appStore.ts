import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { IDashboardData, IApp, IMonitoringTrend, INotificationRule } from '../types/App.interface.ts';

export enum Period {
    Today     = 'today',
    Yesterday = 'yesterday',
    Week      = 'week',
    Month     = 'month',
}

interface IAppStore {
    // Data
    apps: IApp[];
    yesterdayApps: IApp[];
    monitoringSeconds: number;
    totalSecondsToday: number;
    activeApps: string[];
    trendData: IMonitoringTrend[];
    notificationRules: INotificationRule[];
    // UI
    period: Period;
    searchQuery: string;
    isIdle: boolean;
    isMonitoring: boolean;
    goalJustReached: boolean;
    // Actions
    setPeriod: (p: Period) => void;
    setSearchQuery: (q: string) => void;
    dismissGoalToast: () => void;
    fetchDashboard: (period?: Period) => Promise<void>;
    toggleMonitoring: () => Promise<void>;
    refreshNotifications: () => void;
    initListeners: () => Promise<() => void>;
}

export const useAppStore = create<IAppStore>((set, get) => ({
    apps: [],
    yesterdayApps: [],
    monitoringSeconds: 0,
    totalSecondsToday: 0,
    activeApps: [],
    trendData: [],
    notificationRules: [],
    period: Period.Today,
    searchQuery: '',
    isIdle: false,
    isMonitoring: false,
    goalJustReached: false,

    setPeriod: (p: Period) => {
        set({ period: p });
        get().fetchDashboard(p);
    },

    setSearchQuery: (q: string) => set({ searchQuery: q }),

    dismissGoalToast: () => set({ goalJustReached: false }),

    fetchDashboard: async (period?: Period) => {
        try {
            const p = period ?? get().period;
            const data = await invoke<IDashboardData>('get_dashboard_data', { period: p });
            set({
                apps: data.apps,
                yesterdayApps: data.yesterday_apps,
                monitoringSeconds: data.monitoring_seconds,
                totalSecondsToday: data.total_seconds_today,
                activeApps: data.active_apps,
                trendData: data.trend_data,
            });
        } catch (err) {
            console.error('[appStore] fetchDashboard failed:', err);
        }
    },

    toggleMonitoring: async () => {
        set(s => ({ isMonitoring: !s.isMonitoring }));
        await invoke('toggle_monitoring');
    },

    refreshNotifications: () => {
        invoke<INotificationRule[]>('get_app_notifications').then(rules => set({ notificationRules: rules }));
    },

    initListeners: async () => {
        // Set up event listeners first — independent of initial data load
        const visibilityHandler = () => {
            if (document.visibilityState === 'visible') get().fetchDashboard();
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // Polling fallback — active only until the first monitoring-tick proves events work.
        let pollInterval: ReturnType<typeof window.setInterval> | null = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                get().fetchDashboard().catch(() => {});
            }
        }, 2000);

        const unlistenTick = await listen<{ is_idle: boolean }>('monitoring-tick', event => {
            // Events are confirmed working — kill the polling fallback.
            if (pollInterval !== null) {
                window.clearInterval(pollInterval);
                pollInterval = null;
            }
            set({ isIdle: event.payload.is_idle });
            if (document.visibilityState === 'visible') {
                get().fetchDashboard().catch(err => console.error('[appStore] tick fetchDashboard failed:', err));
            }
        });

        const unlistenGoal = await listen<null>('daily-goal-reached', () => {
            set({ goalJustReached: true });
        });

        // Initial data load — non-fatal: listeners are already registered above
        get().fetchDashboard().catch(err => console.error('[appStore] Initial fetchDashboard failed:', err));

        // Initial monitoring status
        invoke<boolean>('get_monitoring_status')
            .then(active => set({ isMonitoring: active }))
            .catch(err => console.error('[appStore] get_monitoring_status failed:', err));

        // Initial notifications
        get().refreshNotifications();

        return () => {
            unlistenTick();
            unlistenGoal();
            if (pollInterval !== null) window.clearInterval(pollInterval);
            document.removeEventListener('visibilitychange', visibilityHandler);
        };
    },
}));
