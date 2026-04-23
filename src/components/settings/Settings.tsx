import React, { FC, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

  useEffect(() => {
    invoke<boolean>("plugin:autostart|is_enabled")
      .then(setAutostart)
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

  const handleDailyGoalChange = async (value: string) => {
    const seconds = Number(value);
    setDailyGoalSeconds(seconds);
    await invoke("set_preference", { key: "daily_goal_seconds", value }).catch(
      () => {},
    );
  };

  return (
    <div className="bg-[#0f0f1a] border border-white/10 rounded-2xl px-6 py-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">
          Settings
        </h2>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-white/40 uppercase tracking-widest">
          Monitoring interval
        </label>
        <Select
          value={String(monitoringInterval)}
          options={INTERVAL_OPTIONS}
          onChange={handleSave}
        />
        {saved && (
          <p className="text-xs text-green-400 mt-1">
            Saved — monitoring restarted with new interval.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-white/60">Focus-only tracking</span>
          <span className="text-xs text-white/25 mt-0.5">
            Only count time for the app you're actively using
          </span>
        </div>
        <button
          onClick={handleFocusTrackingToggle}
          className={`relative w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 ${
            focusTracking ? "bg-purple-600" : "bg-white/10"
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

      <div className="flex flex-col gap-2">
        <label className="text-xs text-white/40 uppercase tracking-widest">
          Idle detection threshold
        </label>
        <Select
          value={idleThreshold}
          options={IDLE_OPTIONS}
          onChange={handleIdleThresholdChange}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-white/40 uppercase tracking-widest">
          Daily screen time goal
        </label>
        <Select
          value={String(dailyGoalSeconds)}
          options={GOAL_OPTIONS}
          onChange={handleDailyGoalChange}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-white/60">Launch on startup</span>
          <span className="text-xs text-white/25 mt-0.5">
            Start Trimo automatically when Windows starts
          </span>
        </div>
        <button
          onClick={handleAutostartToggle}
          className={`relative w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 ${
            autostart ? "bg-purple-600" : "bg-white/10"
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
    </div>
  );
};

export default Settings;
