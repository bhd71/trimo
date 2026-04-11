use std::{collections::HashSet, num::NonZeroUsize, sync::Arc};

use chrono::{DateTime, Utc};
use lru::LruCache;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppUsage {
    pub id: Option<i64>,
    pub app_name: String,
    pub timestamp: DateTime<Utc>,
    #[serde(default)]
    pub duration: i64,
    pub logo_base64: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppUsageStats {
    pub id: Option<i64>,
    pub app_name: String,
    pub timestamp: DateTime<Utc>,
    pub duration: i64,
    pub formatted_duration: String,
    pub logo_base64: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppDailyUsage {
    pub date: String,
    pub duration: i64,
    pub formatted_duration: String,
}

#[derive(Debug, Serialize)]
pub struct MonitoringTrend {
    pub date: String,
    pub total_seconds: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppNotificationRule {
    pub id: Option<i64>,
    pub app_name: String,
    pub threshold_seconds: i64,
    pub message: String,
    pub enabled: bool,
}

pub struct AppState {
    pub db: Arc<Mutex<SqlitePool>>,
    pub monitoring_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    pub logo_cache: Arc<Mutex<LruCache<String, Option<String>>>>,
    pub active_apps: Arc<Mutex<Vec<String>>>,
    pub current_exe_name: String,
    pub notification_fired: Arc<Mutex<HashSet<String>>>,
    pub focus_app: Arc<Mutex<Option<String>>>,
}

pub fn new_logo_cache() -> LruCache<String, Option<String>> {
    LruCache::new(NonZeroUsize::new(200).unwrap())
}
