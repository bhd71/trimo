use std::{env, path::Path, time::Duration};

use sqlx::sqlite::SqlitePool;

pub fn get_safe_database_path() -> String {
    if cfg!(debug_assertions) {
        let temp_dir = env::temp_dir();
        let db_path = temp_dir.join("tauri_trimo_dev.db");
        log::debug!("Development database path: {}", db_path.display());
        format!("sqlite:{}?mode=rwc", db_path.to_string_lossy())
    } else {
        let app_data = env::var("APPDATA")
            .or_else(|_| env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        let db_path = Path::new(&app_data).join("Trimo").join("app_usage.db");

        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        format!("sqlite:{}?mode=rwc", db_path.to_string_lossy())
    }
}

pub async fn connect() -> SqlitePool {
    let database_url = get_safe_database_path();
    log::info!("Using database: {}", database_url);

    match SqlitePool::connect_with(
        database_url
            .parse::<sqlx::sqlite::SqliteConnectOptions>()
            .expect("Invalid database URL")
            .busy_timeout(Duration::from_secs(10))
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal),
    )
    .await
    {
        Ok(db) => {
            log::info!("Database connection established successfully");
            db
        }
        Err(e) => {
            log::error!("Failed to connect to database: {}", e);
            std::process::exit(1);
        }
    }
}

pub async fn setup_database(db: &SqlitePool) {
    // apps table — logo stored once per app, never duplicated
    if let Err(e) = sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS apps (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            logo_base64 TEXT
        )
        "#,
    )
    .execute(db)
    .await
    {
        log::error!("Failed to create apps table: {}", e);
        std::process::exit(1);
    }

    // Normalized app_usage: one row per app per day, no logo column
    if let Err(e) = sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS app_usage (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id   INTEGER NOT NULL REFERENCES apps(id),
            date     TEXT    NOT NULL,
            duration INTEGER NOT NULL DEFAULT 0,
            UNIQUE(app_id, date)
        )
        "#,
    )
    .execute(db)
    .await
    {
        log::error!("Failed to create app_usage table: {}", e);
        std::process::exit(1);
    }

    if let Err(e) = sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS monitoring_stats (
            date          TEXT PRIMARY KEY,
            total_seconds INTEGER NOT NULL DEFAULT 0
        )
        "#,
    )
    .execute(db)
    .await
    {
        log::error!("Failed to create monitoring_stats table: {}", e);
        std::process::exit(1);
    }

    if let Err(e) = sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS user_preferences (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        "#,
    )
    .execute(db)
    .await
    {
        log::error!("Failed to create user_preferences table: {}", e);
        std::process::exit(1);
    }

    let _ = sqlx::query(
        "INSERT OR IGNORE INTO user_preferences (key, value) VALUES ('monitoring_interval', '1')",
    )
    .execute(db)
    .await;

    // Detect old schema (has app_name column) and migrate if needed
    let old_col_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pragma_table_info('app_usage') WHERE name = 'app_name'",
    )
    .fetch_one(db)
    .await
    .unwrap_or(0);

    if old_col_count > 0 {
        migrate_app_usage_v1_to_v2(db).await;
    }

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date)",
    )
    .execute(db)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_app_usage_app_id_date ON app_usage(app_id, date)",
    )
    .execute(db)
    .await;

    if let Err(e) = sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS app_notifications (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name          TEXT    NOT NULL UNIQUE,
            threshold_seconds INTEGER NOT NULL,
            message           TEXT    NOT NULL,
            enabled           INTEGER NOT NULL DEFAULT 1
        )
        "#,
    )
    .execute(db)
    .await
    {
        log::warn!("Failed to create app_notifications table: {}", e);
    }

    log::info!("Database setup completed successfully");
}

async fn migrate_app_usage_v1_to_v2(db: &SqlitePool) {
    log::info!("Migrating app_usage to normalized schema...");

    // Extract one logo per app from old rows into apps table
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO apps (name, logo_base64)
         SELECT app_name, MAX(logo_base64) FROM app_usage GROUP BY app_name",
    )
    .execute(db)
    .await;

    // Create staging table with new schema
    let _ = sqlx::query("DROP TABLE IF EXISTS app_usage_v2").execute(db).await;
    if let Err(e) = sqlx::query(
        r#"
        CREATE TABLE app_usage_v2 (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id   INTEGER NOT NULL REFERENCES apps(id),
            date     TEXT    NOT NULL,
            duration INTEGER NOT NULL DEFAULT 0,
            UNIQUE(app_id, date)
        )
        "#,
    )
    .execute(db)
    .await
    {
        log::error!("Migration: failed to create staging table: {}", e);
        return;
    }

    // Copy aggregated data (sum duration per app per day)
    let _ = sqlx::query(
        r#"
        INSERT OR IGNORE INTO app_usage_v2 (app_id, date, duration)
        SELECT a.id, date(u.timestamp), SUM(u.duration)
        FROM app_usage u
        JOIN apps a ON a.name = u.app_name
        GROUP BY a.id, date(u.timestamp)
        "#,
    )
    .execute(db)
    .await;

    // Swap tables
    let _ = sqlx::query("ALTER TABLE app_usage RENAME TO app_usage_v1_backup").execute(db).await;
    let _ = sqlx::query("ALTER TABLE app_usage_v2 RENAME TO app_usage").execute(db).await;
    let _ = sqlx::query("DROP TABLE IF EXISTS app_usage_v1_backup").execute(db).await;

    log::info!("Migration complete: logos deduplicated into apps table.");
}
