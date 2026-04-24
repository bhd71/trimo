# Trimo – Project Guidelines

Trimo is a **Windows desktop app** that tracks application usage time. Stack: **Tauri 2 + React 18 + TypeScript + Vite + Tailwind CSS 4** (frontend) and **Rust + SQLite (sqlx) + Windows Win32 API** (backend).

---

## Build & Dev Commands

```bash
# Full Tauri dev (starts React dev server + Rust backend)
npx tauri dev

# Frontend only (port 1420)
npm run dev

# Production build
npx tauri build

# TypeScript check + Vite bundle
npm run build
```

No test suite is configured. To verify Rust code: `cargo check` inside `src-tauri/`.

### Releasing a new version

Always use the release script — never bump versions or tag manually:

```powershell
.\release.ps1 <MAJOR.MINOR.PATCH>
# Example: .\release.ps1 0.1.5
```

It bumps `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, then commits, tags, and pushes in one shot.

---

## Architecture

```
src/                          # React frontend
  App.tsx                     # Root: initializes listeners + preferences; renders DashboardLayout + AppsList
  main.tsx                    # React entry point
  components/
    apps/
      AppsList.tsx            # Main container: fetches dashboard data, handles period/search/sort
      AppFilterBar.tsx        # Search bar + sort dropdown (logic absorbed into AppsList)
      app-item/
        AppItem.tsx           # App card: logo, name, duration, % share, vs-yesterday, bell badge
        AppDetailsModal.tsx   # Modal: week/month tabs, chart, table, trend, peak, notifications
        ModalHeader.tsx       # Modal title bar
        DailyUsageChart.tsx   # Bar chart for single app (last 30 days)
        DailyUsageTable.tsx   # Table of daily usage rows
        NotificationSection.tsx  # Per-app notification rule editor
      period-selector/
        PeriodSelector.tsx    # Today / Yesterday / This Week / This Month buttons
    charts/
      UsageChart.tsx          # Bar chart of top 12 apps for selected period
      TrendChart.tsx          # Area chart of daily screen time (7–30 days)
    dashboard/
      DashboardLayout.tsx     # Layout wrapper; settings modal; keyboard shortcuts; goal-reached toast
      ActiveApps.tsx          # Live list of running apps with ripple animation
      GoalProgress.tsx        # Daily goal progress bar (hidden if goal ≤ 0)
      TodaySummary.tsx        # Total tracked time + most-used app cards
      TrackingStatus.tsx      # Status dot (Tracking / Idle / Not tracking) + Start/Stop button
    settings/
      Settings.tsx            # Modal: interval, idle threshold, daily goal, autostart, focus tracking
      AppNotifications.tsx    # Legacy notification panel (superseded by per-app NotificationSection)
    ui/
      Select.tsx              # Generic dropdown component
      ToggleRow.tsx           # Labeled toggle switch
  helpers/
    format-time.ts            # formatSeconds(), yAxisTick(), formatDateLabel()
    app-stats.ts              # pctChange(), sortApps()
    image-convert.tsx         # base64ToBlob(), Base64Image, useLogo() hook, AppLogo component
    name-truncate.tsx         # TruncatedText component
  store/
    appStore.ts               # Zustand: apps, period, monitoring state, trend, notifications
    settingsStore.ts          # Zustand: monitoringInterval, dailyGoalSeconds
  tests/
    app-stats.test.ts
    format-time.test.ts
  types/
    App.interface.ts          # IApp, IAppDailyUsage, INotificationRule, IMonitoringTrend, IDashboardData

src-tauri/src/
  lib.rs                      # Slim entry point: module declarations, run()
  state.rs                    # AppState + all shared structs
  db.rs                       # connect(), setup_database(), get_safe_database_path(), migration
  commands/
    mod.rs
    apps.rs                   # list_opened_apps, get_focused_app
    monitoring.rs             # toggle_monitoring, get_monitoring_status, apply_monitoring_interval
    usage.rs                  # get_app_usage_stats, get_dashboard_data, get_app_daily_usage,
                              #   get_monitoring_trend, get_app_logo, get_total_monitoring_time
    preferences.rs            # get_preference, set_preference
    notifications.rs          # get_app_notifications, upsert_app_notification, delete_app_notification
  process/
    mod.rs
    filter.rs                 # get_current_exe_name(), is_process_safe_to_monitor()
    enumerator.rs             # AppInfo, get_opened_apps_with_info(), get_foreground_app_name()
    idle.rs                   # is_system_idle() via GetLastInputInfo
  logo/
    mod.rs
    extractor.rs              # extract_app_logo() — Win32 JUMBO image list (256×256 PNG)
    placeholder.rs            # create_placeholder_logo() — SVG fallback with first letter
  helpers/
    mod.rs
    name_helper.rs            # map_helper_to_main_app(), should_skip_process(), format_duration()
```

---

## Tauri Commands

| Command | File | Purpose |
|---------|------|---------|
| `list_opened_apps` | apps.rs | App names from last monitoring cycle |
| `get_focused_app` | apps.rs | Currently focused app name |
| `toggle_monitoring` | monitoring.rs | Start / stop background monitoring task |
| `get_monitoring_status` | monitoring.rs | Whether monitoring is running |
| `apply_monitoring_interval` | monitoring.rs | Update interval; restart if active |
| `get_app_usage_history` | usage.rs | Recent raw usage records |
| `get_app_usage_stats` | usage.rs | Per-app aggregated totals for a period |
| `get_total_monitoring_time` | usage.rs | Total monitored seconds for a period |
| `get_app_daily_usage` | usage.rs | Daily breakdown for one app (last 30 days) |
| `get_monitoring_trend` | usage.rs | Daily totals for trend chart |
| `get_dashboard_data` | usage.rs | Single call returning all dashboard data |
| `get_app_logo` | usage.rs | Lazy-load base64 PNG logo for an app |
| `get_preference` | preferences.rs | Read a user preference by key |
| `set_preference` | preferences.rs | Write a user preference by key |
| `get_app_notifications` | notifications.rs | All notification rules |
| `upsert_app_notification` | notifications.rs | Create/update a notification rule |
| `delete_app_notification` | notifications.rs | Delete a notification rule |

---

## Data Flow

**Updates:** Frontend is event-driven. `App.tsx` calls `initListeners()` which subscribes to:
1. The `monitoring-tick` Tauri event (emitted every cycle by the backend) — primary update path
2. `document.visibilitychange` — refetch when tab becomes visible
3. A 2 s polling fallback (safety net)

**Dashboard data:** `AppsList` calls `get_dashboard_data` (single IPC call) which returns apps, totals, trend, and yesterday data in one shot.

**Global Rust state (`AppState`):**
```rust
db: SqlitePool
monitoring_task: Arc<Mutex<Option<JoinHandle<()>>>>
logo_cache: Arc<Mutex<LruCache<String, Option<String>>>>  // capacity 200
active_apps: Arc<Mutex<Vec<String>>>
current_exe_name: String
focus_app: Arc<Mutex<Option<String>>>
last_external_focus: Arc<Mutex<Option<String>>>  // preserves time when user switches to Trimo
```

---

## Conventions

### TypeScript / React
- Interfaces are `I`-prefixed: `IApp`, `IProps`
- Component props: local `interface IProps` inside the file, typed as `FC<IProps>`
- Global state via **Zustand** (`appStore`, `settingsStore`) — no Redux/Context
- No router — single-page, single-view desktop app
- Tailwind utility classes inline in JSX; no CSS modules
- Keyboard shortcuts centralized in `DashboardLayout`: `Ctrl+F` (search), `Escape` (close), `1–4` (period switch)

### Rust
- `lib.rs` is a slim entry point only — all logic lives in dedicated modules
- Tauri commands are `async` and live in `commands/` submodules (one file per concern)
- Windows API calls use the `windows` 0.56 crate (`Win32::*`)
- SQLite queries use raw `sqlx::query()` with `.bind()` (not the macro form)
- All DB writes in `perform_monitoring_cycle()` are wrapped in a single transaction
- Background task handle stored in `Arc<Mutex<Option<JoinHandle<()>>>>` in `AppState`
- All date comparisons use **local time**: `date('now', 'localtime')` in SQL, `Local::now()` in Rust — never `Utc::now()` or bare `date('now')`

### Database
| Env | Path |
|-----|------|
| Dev | `%TEMP%/tauri_trimo_dev.db` |
| Prod | `%APPDATA%/Trimo/app_usage.db` |

Tables:
```sql
apps             (id, name UNIQUE, logo_base64)
app_usage        (id, app_id → apps.id, date TEXT, duration INTEGER)  -- UNIQUE(app_id, date)
monitoring_stats (date TEXT PK, total_seconds INTEGER)
user_preferences (key TEXT PK, value TEXT)
app_notifications(id, app_name UNIQUE, threshold_seconds, message, enabled)
notifications    (app_name, date — composite PK)  -- deduplication: one fire per rule per day
```

`user_preferences` keys:

| Key | Default | Purpose |
|-----|---------|---------|
| `monitoring_interval` | `5` | Polling interval (seconds) |
| `idle_threshold_minutes` | `5` | Idle detection window |
| `daily_goal_seconds` | `0` | Daily goal; 0 = disabled |
| `focus_tracking_enabled` | `true` | Track only focused app vs all open apps |
| `autostart_initialized` | (unset) | Has autostart been configured? |

**Migration:** On startup, if the old denormalized `app_usage` schema (with `app_name`/`logo_base64` columns) is detected, an automatic migration to the normalized schema runs.

---

## Key Pitfalls

- **Windows-only**: The `windows` crate and Win32 calls will not compile on other platforms.
- **Local time for dates**: Always use `date('now', 'localtime')` in SQL and `Local::now()` in Rust — never `Utc::now()` or bare `date('now')`. The day boundary must match the user's local midnight.
- **Logo extraction**: Real 256×256 icons extracted via Win32 `SHGetImageList(SHIL_JUMBO)` + `DrawIconEx`; BGRA→RGBA converted and base64-encoded as PNG. Falls back to placeholder SVG (first letter + color). Logos are cached in `AppState.logo_cache` (LRU, capacity 200, in-memory per-session).
- **Focus tracking mode**: When `focus_tracking_enabled = true` (default), only the foreground app accumulates time. When false, all open apps accumulate equally.
- **Last-external-focus**: When the user switches to the Trimo window, time keeps accumulating for the previously focused app (stored in `last_external_focus`). Do not break this logic.
- **Helper process mapping**: Many helper executables (e.g., `steamwebhelper.exe`) must be resolved to their parent app name in `name_helper.rs` — update this list when adding new app support.
- **Self-exclusion**: The backend skips its own process; the current exe name is stored in `AppState.current_exe_name` at startup.
- **Notifications deduplication**: Fired notifications are recorded in the `notifications` table. Each rule fires at most once per day per app.
- **Schema migration**: `db.rs` runs an automatic migration from the old denormalized schema. Do not remove this logic without a proper versioning strategy.
- **Event-driven updates**: Primary data refresh is via the `monitoring-tick` Tauri event. The 2 s polling fallback is a safety net only — keep this in mind when adding real-time features.
