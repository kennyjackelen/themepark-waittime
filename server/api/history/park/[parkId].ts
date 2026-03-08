import { getDb } from '../../../utils/db'
import { parkToday } from '../../../utils/timezone'

export default defineEventHandler((event) => {
  const parkId = getRouterParam(event, 'parkId')
  if (!parkId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing parkId' })
  }

  const db = getDb()
  const today = parkToday()

  const rows = db.prepare(`
    SELECT ride_id, wait_minutes, observed_at
    FROM wait_observations
    WHERE park_id = ? AND observed_at >= ? AND observed_at < ?
    ORDER BY observed_at ASC
  `).all(parkId, `${today}T00:00:00`, `${today}T23:59:59`) as {
    ride_id: string
    wait_minutes: number
    observed_at: string
  }[]

  const history: Record<string, { time: string; waitMinutes: number }[]> = {}
  for (const row of rows) {
    if (!history[row.ride_id]) history[row.ride_id] = []
    history[row.ride_id].push({
      time: row.observed_at,
      waitMinutes: row.wait_minutes,
    })
  }

  return { parkId, date: today, history }
})
