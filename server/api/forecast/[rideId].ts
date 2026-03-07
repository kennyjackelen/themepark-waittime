import { getDb } from '../../utils/db'
import { buildForecast } from '../../utils/forecast'

export default defineEventHandler((event) => {
  const rideId = getRouterParam(event, 'rideId')
  if (!rideId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing rideId' })
  }

  const query = getQuery(event)
  const dayOfWeek = query.dow !== undefined ? Number(query.dow) : new Date().getDay()

  const db = getDb()
  const { source, forecast } = buildForecast(db, rideId, dayOfWeek)

  const totalObservations = db.prepare(
    'SELECT COUNT(*) as count FROM wait_observations WHERE ride_id = ?'
  ).get(rideId) as { count: number }

  return {
    rideId,
    dayOfWeek,
    source,
    totalObservations: totalObservations.count,
    forecast: forecast.map((f) => ({
      hour: f.hour,
      minute: 0,
      projectedWait: f.projectedWait,
      sampleCount: f.sampleCount,
      adjusted: f.adjusted,
    })),
  }
})
