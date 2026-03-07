import { getDb } from '../../../utils/db'
import { buildForecast } from '../../../utils/forecast'

export default defineEventHandler((event) => {
  const parkId = getRouterParam(event, 'parkId')
  if (!parkId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing parkId' })
  }

  const query = getQuery(event)
  const dayOfWeek = query.dow !== undefined ? Number(query.dow) : new Date().getDay()

  const db = getDb()

  // Get all rides for this park that have data
  const rides = db.prepare(
    'SELECT DISTINCT ride_id FROM wait_observations WHERE park_id = ?'
  ).all(parkId) as { ride_id: string }[]

  const forecasts: Record<string, { source: string; forecast: any[] }> = {}

  for (const ride of rides) {
    const result = buildForecast(db, ride.ride_id, dayOfWeek)
    if (result.forecast.length > 0) {
      forecasts[ride.ride_id] = {
        source: result.source,
        forecast: result.forecast.map((f) => ({
          hour: f.hour,
          minute: 0,
          projectedWait: f.projectedWait,
          low: f.low,
          high: f.high,
          sampleCount: f.sampleCount,
          adjusted: f.adjusted,
        })),
      }
    }
  }

  return {
    parkId,
    dayOfWeek,
    forecasts,
  }
})
