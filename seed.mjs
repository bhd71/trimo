import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.tmpdir(), 'tauri_trimo_dev.db');
console.log('Seeding database at:', DB_PATH);

const db = new Database(DB_PATH);

// Ensure tables match the current normalized schema
db.exec(`
  CREATE TABLE IF NOT EXISTS apps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    logo_base64 TEXT
  );
  CREATE TABLE IF NOT EXISTS app_usage (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id   INTEGER NOT NULL REFERENCES apps(id),
    date     TEXT    NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    UNIQUE(app_id, date)
  );
  CREATE TABLE IF NOT EXISTS monitoring_stats (
    date          TEXT PRIMARY KEY,
    total_seconds INTEGER NOT NULL DEFAULT 0
  );
`);

const apps = [
  'VS Code',
  'Chrome',
  'Discord',
  'Spotify',
  'Firefox',
  'Steam',
  'Slack',
  'Figma',
  'Postman',
  'Windows Terminal',
  'Notion',
  'Zoom',
];

// Usage patterns per app (seconds per day, roughly realistic)
const usagePatterns = {
  'VS Code':          { weekday: 14400, weekend: 3600  },  // 4h / 1h
  'Chrome':           { weekday: 10800, weekend: 7200  },  // 3h / 2h
  'Discord':          { weekday: 5400,  weekend: 10800 },  // 1.5h / 3h
  'Spotify':          { weekday: 7200,  weekend: 9000  },  // 2h / 2.5h
  'Firefox':          { weekday: 3600,  weekend: 5400  },  // 1h / 1.5h
  'Steam':            { weekday: 1800,  weekend: 14400 },  // 0.5h / 4h
  'Slack':            { weekday: 9000,  weekend: 0     },  // 2.5h / 0h
  'Figma':            { weekday: 7200,  weekend: 1800  },  // 2h / 0.5h
  'Postman':          { weekday: 3600,  weekend: 0     },  // 1h / 0h
  'Windows Terminal': { weekday: 5400,  weekend: 1800  },  // 1.5h / 0.5h
  'Notion':           { weekday: 2700,  weekend: 1800  },  // 0.75h / 0.5h
  'Zoom':             { weekday: 3600,  weekend: 0     },  // 1h / 0h
};

// Jitter ±20%
function jitter(value) {
  if (value === 0) return 0;
  return Math.round(value * (0.8 + Math.random() * 0.4));
}

// Clear existing mock data
db.exec(`DELETE FROM app_usage; DELETE FROM monitoring_stats; DELETE FROM apps;`);
console.log('Cleared existing data.');

// Insert apps and collect their IDs
const insertApp = db.prepare(`INSERT INTO apps (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name=name RETURNING id`);
const appIds = {};
for (const app of apps) {
  const row = insertApp.get(app);
  appIds[app] = row.id;
}

const insertUsage = db.prepare(
  `INSERT INTO app_usage (app_id, date, duration) VALUES (?, ?, ?)
   ON CONFLICT(app_id, date) DO UPDATE SET duration = duration + excluded.duration`
);
const insertStats = db.prepare(
  `INSERT OR REPLACE INTO monitoring_stats (date, total_seconds) VALUES (?, ?)`
);

const today = new Date();

const insertAll = db.transaction(() => {
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    for (const app of apps) {
      const pattern = usagePatterns[app];
      const base = isWeekend ? pattern.weekend : pattern.weekday;
      const duration = jitter(base);
      if (duration === 0) continue;
      insertUsage.run(appIds[app], dateStr, duration);
    }

    const totalMonitoring = jitter(28800); // ~8h per day
    insertStats.run(dateStr, totalMonitoring);

    console.log(`  ${dateStr} (${isWeekend ? 'weekend' : 'weekday'}) seeded`);
  }
});

insertAll();

db.close();
console.log('\nDone! Database seeded with 30 days of mock data for', apps.length, 'apps.');
