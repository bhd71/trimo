import React, { FC, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import Select, { ISelectOption } from "../ui/Select.tsx";
import { useSettingsStore } from "../../store/settingsStore.ts";

const INTERVAL_OPTIONS: ISelectOption<string>[] = [
  { label: "1 second", value: "1" },
  { label: "5 seconds", value: "5" },
  { label: "10 seconds", value: "10" },
  { label: "30 seconds", value: "30" },
  { label: "60 seconds", value: "60" },
];

const IDLE_OPTIONS: ISelectOption<string>[] = [
  { label: "Disabled", value: "0" },
  { label: "1 minute", value: "1" },
  { label: "2 minutes", value: "2" },
  { label: "5 minutes", value: "5" },
  { label: "10 minutes", value: "10" },
  { label: "15 minutes", value: "15" },
];

const GOAL_OPTIONS: ISelectOption<string>[] = [
  { label: "No goal", value: "0" },
  { label: "1 hour", value: "3600" },
  { label: "2 hours", value: "7200" },
  { label: "3 hours", value: "10800" },
  { label: "4 hours", value: "14400" },
  { label: "6 hours", value: "21600" },
  { label: "8 hours", value: "28800" },
];

const SAVE_FEEDBACK_DURATION_MS = 2000;

interface IProps {
  onClose: () => void;
}

const Settings: FC<IProps> = ({ onClose }) => {
  const monitoringInterval = useSettingsStore((s) => s.monitoringInterval);
  const updateMonitoringInterval = useSettingsStore(
    (s) => s.updateMonitoringInterval,
  );
  const dailyGoalSeconds = useSettingsStore((s) => s.dailyGoalSeconds);
  const setDailyGoalSeconds = useSettingsStore((s) => s.setDailyGoalSeconds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [focusTracking, setFocusTracking] = useState(false);
  const [idleThreshold, setIdleThreshold] = useState("5");
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle');
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    invoke<string | null>("get_preference", { key: "autostart_initialized" })
      .then(async (initialized) => {
        if (!initialized) {
          // First launch — enable autostart by default
          await invoke("plugin:autostart|enable").catch(() => {});
          await invoke("set_preference", { key: "autostart_initialized", value: "true" }).catch(() => {});
          setAutostart(true);
        } else {
          invoke<boolean>("plugin:autostart|is_enabled")
            .then(setAutostart)
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<string | null>("get_preference", { key: "focus_tracking_enabled" })
      .then((val) => setFocusTracking(val === "true"))
      .catch(() => {});
    invoke<string | null>("get_preference", { key: "idle_threshold_minutes" })
      .then((val) => {
        if (val) setIdleThreshold(val);
      })
      .catch(() => {});
    invoke<string | null>("get_preference", { key: "auto_update_enabled" })
      .then((val) => setAutoUpdate(val === "true"))
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async (value: string) => {
    setSaving(true);
    setSaved(false);
    await updateMonitoringInterval(Number(value));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), SAVE_FEEDBACK_DURATION_MS);
  };

  const handleAutostartToggle = async () => {
    const next = !autostart;
    setAutostart(next);
    try {
      await invoke(
        next ? "plugin:autostart|enable" : "plugin:autostart|disable",
      );
    } catch {
      setAutostart(!next); // revert on error
    }
  };

  const handleFocusTrackingToggle = async () => {
    const next = !focusTracking;
    setFocusTracking(next);
    try {
      await invoke("set_preference", {
        key: "focus_tracking_enabled",
        value: String(next),
      });
    } catch {
      setFocusTracking(!next); // revert on error
    }
  };

  const handleIdleThresholdChange = async (value: string) => {
    setIdleThreshold(value);
    await invoke("set_preference", {
      key: "idle_threshold_minutes",
      value,
    }).catch(() => {});
  };

  const handleAutoUpdateToggle = async () => {
    const next = !autoUpdate;
    setAutoUpdate(next);
    await invoke("set_preference", { key: "auto_update_enabled", value: String(next) }).catch(() => {});
  };

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setAvailableVersion(null);
    try {
      const update = await check();
      if (update?.available) {
        setUpdateStatus('available');
        setAvailableVersion(update.version);
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch {
      setUpdateStatus('error');
    }
  };

  const handleInstallUpdate = async () => {
    setInstalling(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch {
      setInstalling(false);
      setUpdateStatus('error');
    }
  };

  const handleDailyGoalChange = async (value: string) => {
    const seconds = Number(value);
    setDailyGoalSeconds(seconds);
    await invoke("set_preference", { key: "daily_goal_seconds", value }).catch(
      () => {},
    );
  };

  return (
    <div className="bg-neutral-900/95 backdrop-blur-md border border-white/10 shadow-xl rounded-2xl px-6 py-5 flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest">
          Settings
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-150"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      {/* Select rows */}
      <div className="flex flex-col gap-4 py-5 border-b border-white/5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-widest">
            Monitoring interval
          </label>
          <Select
            value={String(monitoringInterval)}
            options={INTERVAL_OPTIONS}
            onChange={handleSave}
            className="w-full"
          />
          {saved && (
            <p className="text-xs text-green-400">
              Saved — monitoring restarted with new interval.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-widest">
            Idle detection threshold
          </label>
          <Select
            value={idleThreshold}
            options={IDLE_OPTIONS}
            onChange={handleIdleThresholdChange}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50 uppercase tracking-widest">
            Daily screen time goal
          </label>
          <Select
            value={String(dailyGoalSeconds)}
            options={GOAL_OPTIONS}
            onChange={handleDailyGoalChange}
            className="w-full"
          />
        </div>
      </div>

      {/* Toggle rows */}
      <div className="flex flex-col gap-4 pt-5">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/80">Focus-only tracking</p>
            <p className="text-xs text-white/40 mt-0.5">Only count time for the app you're actively using</p>
          </div>
          <button
            onClick={handleFocusTrackingToggle}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:ring-offset-1 focus:ring-offset-neutral-900 ${
              focusTracking ? "bg-purple-600" : "bg-white/10 hover:bg-white/15"
            }`}
            aria-label="Toggle focus-only tracking"
          >
            <span
              className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                focusTracking ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/80">Launch on startup</p>
            <p className="text-xs text-white/40 mt-0.5">Start Trimo automatically when Windows starts</p>
          </div>
          <button
            onClick={handleAutostartToggle}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:ring-offset-1 focus:ring-offset-neutral-900 ${
              autostart ? "bg-purple-600" : "bg-white/10 hover:bg-white/15"
            }`}
            aria-label="Toggle launch on startup"
          >
            <span
              className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                autostart ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/80">Auto-update</p>
            <p className="text-xs text-white/40 mt-0.5">Automatically check for updates on startup</p>
          </div>
          <button
            onClick={handleAutoUpdateToggle}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:ring-offset-1 focus:ring-offset-neutral-900 ${
              autoUpdate ? "bg-purple-600" : "bg-white/10 hover:bg-white/15"
            }`}
            aria-label="Toggle auto-update"
          >
            <span
              className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                autoUpdate ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking' || installing}
              className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all duration-150 disabled:opacity-40 border border-white/10"
            >
              {updateStatus === 'checking' ? 'Checking…' : 'Check for updates'}
            </button>
            {updateStatus === 'up-to-date' && (
              <span className="text-xs text-green-400">You're up to date</span>
            )}
            {updateStatus === 'error' && (
              <span className="text-xs text-red-400">Check failed</span>
            )}
          </div>
          {updateStatus === 'available' && availableVersion && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/60">v{availableVersion} available</span>
              <button
                onClick={handleInstallUpdate}
                disabled={installing}
                className="px-3 py-1 rounded-full text-xs font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 hover:text-white transition-all duration-150 disabled:opacity-40"
              >
                {installing ? 'Installing…' : 'Install & Restart'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
