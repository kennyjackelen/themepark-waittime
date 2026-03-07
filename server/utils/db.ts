import Database from 'better-sqlite3'
import { resolve } from 'path'

const DB_PATH = process.env.WAITTIME_DB_PATH || resolve(process.cwd(), 'data', 'waittimes.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('busy_timeout = 5000')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wait_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      park_id TEXT NOT NULL,
      ride_id TEXT NOT NULL,
      ride_name TEXT NOT NULL,
      wait_minutes INTEGER NOT NULL,
      status TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ride_dow_hour
      ON wait_observations(ride_id, day_of_week, hour);

    CREATE INDEX IF NOT EXISTS idx_observed_at
      ON wait_observations(observed_at);

    CREATE INDEX IF NOT EXISTS idx_park_id
      ON wait_observations(park_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ride_observed
      ON wait_observations(ride_id, observed_at);
  `)
}
