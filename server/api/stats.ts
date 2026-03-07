import { getDb } from '../utils/db'

export default defineEventHandler(() => {
  const db = getDb()

  const total = db.prepare('SELECT COUNT(*) as count FROM wait_observations').get() as { count: number }
  const parks = db.prepare(`
    SELECT park_id, COUNT(*) as observations, COUNT(DISTINCT ride_id) as rides,
           MIN(observed_at) as earliest, MAX(observed_at) as latest
    FROM wait_observations
    GROUP BY park_id
  `).all()

  const daysCovered = db.prepare(`
    SELECT COUNT(DISTINCT DATE(observed_at)) as days FROM wait_observations
  `).get() as { days: number }

  return {
    totalObservations: total.count,
    daysCovered: daysCovered.days,
    parks,
  }
})
