import { getDb } from './db'
import { parkTimeComponents } from './timezone'

/**
 * One-time migration: re-derive day_of_week, hour, and minute columns
 * from the observed_at ISO timestamp using park-local (Eastern) time.
 * Previously these were stored in UTC.
 */
export function migrateTzColumns() {
  const db = getDb()

  const rows = db.prepare(
    'SELECT id, observed_at FROM wait_observations'
  ).all() as { id: number; observed_at: string }[]

  if (rows.length === 0) return

  console.log(`[migrate-tz] Fixing ${rows.length} rows...`)

  const update = db.prepare(
    'UPDATE wait_observations SET day_of_week = ?, hour = ?, minute = ? WHERE id = ?'
  )

  const migrate = db.transaction(() => {
    for (const row of rows) {
      const date = new Date(row.observed_at)
      const { dayOfWeek, hour, minute } = parkTimeComponents(date)
      update.run(dayOfWeek, hour, minute, row.id)
    }
  })

  migrate()
  console.log(`[migrate-tz] Done, updated ${rows.length} rows`)
}
