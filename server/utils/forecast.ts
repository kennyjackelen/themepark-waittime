import type Database from 'better-sqlite3'

export interface HourlyForecast {
  hour: number
  projectedWait: number
  low: number
  high: number
  sampleCount: number
  adjusted: boolean
}

/**
 * Build a forecast for a ride, optionally adjusted by today's actual observations.
 *
 * The adjustment works by comparing today's actual waits against the historical
 * average for the same hours. If the ride has been consistently busier (or quieter)
 * than historical norms, we scale the future hour predictions accordingly.
 *
 * Returns confidence intervals (low/high) based on historical standard deviation.
 * With intraday adjustment, the confidence band narrows because we have more
 * signal about today's conditions.
 */
export function buildForecast(
  db: Database.Database,
  rideId: string,
  dayOfWeek: number,
): { source: string; forecast: HourlyForecast[] } {
  // Step 1: Get historical baseline (day-specific, then all-days fallback)
  let baseline = queryBaseline(db, rideId, dayOfWeek, 3)
  let source = 'historical_dow'

  if (baseline.length === 0) {
    baseline = queryBaseline(db, rideId, null, 1)
    source = 'historical_all'
  }

  if (baseline.length === 0) {
    return { source: 'none', forecast: [] }
  }

  // Step 2: Get today's actual observations for this ride
  const todayActuals = getTodayActuals(db, rideId)

  // Step 3: Compute intraday bias and apply to future hours
  const forecast = applyIntradayAdjustment(baseline, todayActuals)

  return { source, forecast }
}

interface BaselineRow {
  hour: number
  avgWait: number
  stdWait: number
  sampleCount: number
}

function queryBaseline(
  db: Database.Database,
  rideId: string,
  dayOfWeek: number | null,
  minSamples: number,
): BaselineRow[] {
  // SQLite doesn't have STDDEV, so we compute it from AVG and AVG of squares
  const sql = dayOfWeek !== null
    ? `SELECT hour,
              AVG(wait_minutes) as avgWait,
              CASE WHEN COUNT(*) > 1
                THEN SQRT(AVG(wait_minutes * wait_minutes) - AVG(wait_minutes) * AVG(wait_minutes))
                ELSE 0
              END as stdWait,
              COUNT(*) as sampleCount
       FROM wait_observations
       WHERE ride_id = ? AND day_of_week = ?
       GROUP BY hour
       HAVING sampleCount >= ?
       ORDER BY hour`
    : `SELECT hour,
              AVG(wait_minutes) as avgWait,
              CASE WHEN COUNT(*) > 1
                THEN SQRT(AVG(wait_minutes * wait_minutes) - AVG(wait_minutes) * AVG(wait_minutes))
                ELSE 0
              END as stdWait,
              COUNT(*) as sampleCount
       FROM wait_observations
       WHERE ride_id = ?
       GROUP BY hour
       HAVING sampleCount >= ?
       ORDER BY hour`

  const params = dayOfWeek !== null
    ? [rideId, dayOfWeek, minSamples]
    : [rideId, minSamples]

  return db.prepare(sql).all(...params) as BaselineRow[]
}

interface TodayActual {
  hour: number
  avgWait: number
}

function getTodayActuals(
  db: Database.Database,
  rideId: string,
): TodayActual[] {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  return db.prepare(`
    SELECT hour, AVG(wait_minutes) as avgWait
    FROM wait_observations
    WHERE ride_id = ? AND observed_at >= ?
    GROUP BY hour
    ORDER BY hour
  `).all(rideId, todayStart.toISOString()) as TodayActual[]
}

/**
 * Compare today's actuals against the historical baseline for overlapping hours,
 * then scale future predictions by the observed bias.
 *
 * Confidence intervals use ±1 stddev from the historical data.
 * When intraday adjustment is active, we shrink the interval because
 * we have more info about today's conditions.
 */
function applyIntradayAdjustment(
  baseline: BaselineRow[],
  todayActuals: TodayActual[],
): HourlyForecast[] {
  const currentHour = new Date().getHours()

  const actualByHour = new Map<number, number>()
  for (const a of todayActuals) {
    actualByHour.set(a.hour, a.avgWait)
  }

  const baselineByHour = new Map<number, BaselineRow>()
  for (const b of baseline) {
    baselineByHour.set(b.hour, b)
  }

  // Compute weighted bias ratio from overlapping hours
  let weightedRatioSum = 0
  let weightSum = 0

  for (const actual of todayActuals) {
    const base = baselineByHour.get(actual.hour)
    if (!base || base.avgWait < 5) continue

    const ratio = actual.avgWait / base.avgWait
    const hoursAgo = currentHour - actual.hour
    const weight = Math.pow(0.7, hoursAgo)

    weightedRatioSum += ratio * weight
    weightSum += weight
  }

  const hasBias = weightSum > 0
  const rawRatio = hasBias ? weightedRatioSum / weightSum : 1.0
  const blendedRatio = hasBias ? 0.7 * rawRatio + 0.3 : 1.0
  const clampedRatio = Math.max(0.3, Math.min(3.0, blendedRatio))

  // When we have intraday data, we're more confident — shrink the interval
  // More today-hours observed = tighter confidence
  const confidenceShrink = hasBias
    ? Math.max(0.4, 1 - todayActuals.length * 0.08)
    : 1.0

  return baseline.map((b) => {
    const isPast = b.hour < currentHour
    const todayActual = actualByHour.get(b.hour)

    if (isPast && todayActual !== undefined) {
      return {
        hour: b.hour,
        projectedWait: Math.round(todayActual),
        low: Math.round(todayActual),
        high: Math.round(todayActual),
        sampleCount: b.sampleCount,
        adjusted: false,
      }
    }

    const adjustedWait = hasBias
      ? Math.max(b.avgWait * clampedRatio, 5)
      : b.avgWait

    // ±1 stddev, scaled by the bias ratio and confidence shrink
    const scaledStd = (b.stdWait || 0) * (hasBias ? clampedRatio : 1) * confidenceShrink
    const low = Math.round(Math.max(adjustedWait - scaledStd, 0))
    const high = Math.round(adjustedWait + scaledStd)

    return {
      hour: b.hour,
      projectedWait: Math.round(adjustedWait),
      low,
      high,
      sampleCount: b.sampleCount,
      adjusted: hasBias,
    }
  })
}
