import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface ISettingsStore {
    monitoringInterval: number;
    dailyGoalSeconds: number;
    loadPreferences: () => Promise<void>;
    updateMonitoringInterval: (seconds: number) => Promise<void>;
    setDailyGoalSeconds: (seconds: number) => void;
}

export const useSettingsStore = create<ISettingsStore>((set) => ({
    monitoringInterval: 1,
    dailyGoalSeconds: 0,

    loadPreferences: async () => {
        const [interval, goal] = await Promise.all([
            invoke<string | null>('get_preference', { key: 'monitoring_interval' }),
            invoke<string | null>('get_preference', { key: 'daily_goal_seconds' }),
        ]).catch(err => {
            console.error('[settingsStore] loadPreferences failed:', err);
            return [null, null] as [null, null];
        });
        if (interval) set({ monitoringInterval: Number(interval) });
        if (goal) set({ dailyGoalSeconds: Number(goal) });
    },

    updateMonitoringInterval: async (seconds: number) => {
        await invoke('apply_monitoring_interval', { intervalSeconds: seconds });
        set({ monitoringInterval: seconds });
    },

    setDailyGoalSeconds: (seconds: number) => set({ dailyGoalSeconds: seconds }),
}));
