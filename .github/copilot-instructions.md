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

---

## Architecture

```
src/                          # React frontend
  App.tsx                     # Root: monitoring toggle button
  components/apps/            # AppsList (polling container) + AppItem (card)
  helpers/                    # image-convert, name-truncate utilities
  types/App.interface.ts
src-tauri/src/
  lib.rs                      # Slim entry point: module declarations + run()
  state.rs                    # AppState, AppUsage, AppUsageStats structs
  db.rs                       # connect(), setup_database(), get_safe_database_path()
  process/
    mod.rs                    # Re-exports
    filter.rs                 # get_current_exe_name(), is_process_safe_to_monitor()
    enumerator.rs             # Win32 window enumeration, AppInfo, get_opened_apps_with_info()
  logo/
    mod.rs                    # Re-exports
    extractor.rs              # extract_app_logo() — Win32 JUMBO image list (256×256 PNG)
    placeholder.rs            # create_placeholder_logo() — SVG fallback
  commands/
    mod.rs                    # Re-exports
    apps.rs                   # list_opened_apps Tauri command
    monitoring.rs             # toggle_monitoring, perform_monitoring_cycle
    usage.rs                  # get_app_usage_history, get_app_usage_stats, get_total_monitoring_time
  helpers/name_helper.rs      # Helper-process → main-app name mapping
```

**Frontend → Backend IPC:** `invoke()` from `@tauri-apps/api/core`. Frontend casts results directly (`as IApp[]`).

**Data flow:** `AppsList` polls `get_app_usage_history` every 1 s via `setInterval`. No Tauri events used for updates.

**Global Rust state (`AppState`):** Arc-wrapped SQLite pool + task handle + logo cache + `current_exe_name`. Managed via `tauri::Manager`.

---

## Conventions

### TypeScript / React
- Interfaces are `I`-prefixed: `IApp`, `IProps`
- Component props: local `interface IProps` inside the file, typed as `FC<IProps>`
- No global state library — local `useState` only; no Redux/Zustand
- No router — single-page, single-view desktop app
- Tailwind utility classes inline in JSX; no CSS modules

### Rust
- `lib.rs` is a slim entry point only — all logic lives in dedicated modules
- Tauri commands are `async` and live in `commands/` submodules (one file per concern)
- Windows API calls use the `windows` 0.56 crate (`Win32::*`)
- SQLite queries use raw `sqlx::query()` with `.bind()` (not the macro form)
- Background task handle stored in `Arc<Mutex<Option<JoinHandle<()>>>>` in `AppState`
- Icon extraction uses `SHGetImageList(SHIL_JUMBO)` for 256×256 PNG icons; falls back to placeholder SVG

### Database
| Env | Path |
|-----|------|
| Dev | `%TEMP%/tauri_trimo_dev.db` |
| Prod | `%APPDATA%/Trimo/app_usage.db` |

Tables:
- `app_usage` — `id, app_name, timestamp, duration, logo_base64`
- `monitoring_stats` — `date` (PK), `total_seconds` — upserted each monitoring cycle to track daily monitoring time

---

## Key Pitfalls

- **Windows-only**: The `windows` crate and Win32 calls will not compile on other platforms.
- **Logo extraction**: Real 256×256 icons extracted via Win32 `SHGetImageList(SHIL_JUMBO)` + `DrawIconEx`; BGRA→RGBA converted and base64-encoded as PNG. Falls back to placeholder SVG on failure. Logos are cached in `AppState.logo_cache` (in-memory, per-session).
- **Helper process mapping**: Many helper executables (e.g., `steamwebhelper.exe`) must be resolved to their parent app name in `name_helper.rs` — update this list when adding new app support.
- **Self-exclusion**: The backend skips its own process; the current exe name is stored in `AppState.current_exe_name` at startup.
- **Polling vs events**: Data refresh uses 1 s `setInterval` on the frontend, not Tauri event listeners — keep this in mind when adding real-time features.
