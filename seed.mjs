import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.tmpdir(), 'tauri_trimo_dev.db');
console.log('Seeding database at:', DB_PATH);

const db = new Database(DB_PATH);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS app_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    logo_base64 TEXT
  );
  CREATE TABLE IF NOT EXISTS monitoring_stats (
    date TEXT PRIMARY KEY,
    total_seconds INTEGER NOT NULL DEFAULT 0
  );
`);

const apps = [
  'Discord',
  'chrome',
  'Code',
  'Spotify',
  'firefox',
  'steam',
  'Slack',
];

// Usage patterns per app (seconds per day, roughly realistic)
const usagePatterns = {
  Discord:  { weekday: 5400,  weekend: 10800 },  // 1.5h / 3h
  chrome:   { weekday: 10800, weekend: 7200  },  // 3h / 2h
  Code:     { weekday: 14400, weekend: 3600  },  // 4h / 1h
  Spotify:  { weekday: 7200,  weekend: 9000  },  // 2h / 2.5h
  firefox:  { weekday: 3600,  weekend: 5400  },  // 1h / 1.5h
  steam:    { weekday: 1800,  weekend: 14400 },  // 0.5h / 4h
  Slack:    { weekday: 9000,  weekend: 0     },  // 2.5h / 0h
};

// Jitter ±20%
function jitter(value) {
  if (value === 0) return 0;
  return Math.round(value * (0.8 + Math.random() * 0.4));
}

// Generate data for the past 14 days
const today = new Date();

// Clear existing mock data
db.exec(`DELETE FROM app_usage; DELETE FROM monitoring_stats;`);
console.log('Cleared existing data.');

const insertUsage = db.prepare(
  `INSERT INTO app_usage (app_name, timestamp, duration, logo_base64) VALUES (?, ?, ?, NULL)`
);
const insertStats = db.prepare(
  `INSERT OR REPLACE INTO monitoring_stats (date, total_seconds) VALUES (?, ?)`
);

const insertAll = db.transaction(() => {
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Timestamp at noon on that day
    const timestamp = `${dateStr}T12:00:00.000Z`;

    let monitoringSeconds = 0;

    for (const app of apps) {
      const pattern = usagePatterns[app];
      const base = isWeekend ? pattern.weekend : pattern.weekday;
      const duration = jitter(base);
      if (duration === 0) continue;

      insertUsage.run(app, timestamp, duration);
      monitoringSeconds = Math.max(monitoringSeconds, duration);
    }

    // monitoring_stats: roughly the max single-app time + overhead
    const totalMonitoring = jitter(28800); // ~8h per day
    insertStats.run(dateStr, totalMonitoring);

    console.log(`  ${dateStr} (${isWeekend ? 'weekend' : 'weekday'}) — inserted ${apps.length} apps, monitoring: ${Math.round(totalMonitoring / 3600 * 10) / 10}h`);
  }
});

insertAll();

db.close();
console.log('\nDone! Database seeded with 14 days of mock data.');
