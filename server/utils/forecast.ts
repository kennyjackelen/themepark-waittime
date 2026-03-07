import type Database from 'better-sqlite3'

export interface HourlyForecast {
  hour: number
  projectedWait: number
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
 * Example: if historical average at 11am is 40 min but today it was 60 min,
 * that's a 1.5x ratio. We apply a weighted version of that ratio to the
 * 2pm, 3pm, 4pm predictions too.
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
  sampleCount: number
}

function queryBaseline(
  db: Database.Database,
  rideId: string,
  dayOfWeek: number | null,
  minSamples: number,
): BaselineRow[] {
  const sql = dayOfWeek !== null
    ? `SELECT hour, AVG(wait_minutes) as avgWait, COUNT(*) as sampleCount
       FROM wait_observations
       WHERE ride_id = ? AND day_of_week = ?
       GROUP BY hour
       HAVING sampleCount >= ?
       ORDER BY hour`
    : `SELECT hour, AVG(wait_minutes) as avgWait, COUNT(*) as sampleCount
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
 * Uses a weighted approach: more recent hours get higher weight since they're
 * more indicative of current conditions (weather, crowd levels, etc).
 */
function applyIntradayAdjustment(
  baseline: BaselineRow[],
  todayActuals: TodayActual[],
): HourlyForecast[] {
  const currentHour = new Date().getHours()

  // Build a map of today's actuals by hour
  const actualByHour = new Map<number, number>()
  for (const a of todayActuals) {
    actualByHour.set(a.hour, a.avgWait)
  }

  // Build a map of baseline by hour
  const baselineByHour = new Map<number, BaselineRow>()
  for (const b of baseline) {
    baselineByHour.set(b.hour, b)
  }

  // Compute weighted bias ratio from overlapping hours
  // More recent hours get exponentially more weight
  let weightedRatioSum = 0
  let weightSum = 0

  for (const actual of todayActuals) {
    const base = baselineByHour.get(actual.hour)
    if (!base || base.avgWait < 5) continue // skip very low baselines to avoid divide-by-near-zero

    const ratio = actual.avgWait / base.avgWait
    // Weight: hours closer to now matter more (exponential decay for older hours)
    const hoursAgo = currentHour - actual.hour
    const weight = Math.pow(0.7, hoursAgo) // recent hours weigh ~3x more than 3 hours ago

    weightedRatioSum += ratio * weight
    weightSum += weight
  }

  const hasBias = weightSum > 0
  // Blend: don't go fully to the bias ratio, blend with 1.0 (the baseline)
  // This prevents wild swings from a single noisy hour
  const rawRatio = hasBias ? weightedRatioSum / weightSum : 1.0
  // Blend 70% toward the observed ratio, 30% toward baseline (ratio = 1.0)
  const blendedRatio = hasBias ? 0.7 * rawRatio + 0.3 : 1.0
  // Clamp to prevent extreme adjustments
  const clampedRatio = Math.max(0.3, Math.min(3.0, blendedRatio))

  return baseline.map((b) => {
    const isPast = b.hour < currentHour
    // For past hours where we have actuals, use the actual value
    const todayActual = actualByHour.get(b.hour)
    if (isPast && todayActual !== undefined) {
      return {
        hour: b.hour,
        projectedWait: Math.round(todayActual),
        sampleCount: b.sampleCount,
        adjusted: false,
      }
    }

    // For future hours (or past without actuals), apply the bias
    const adjustedWait = hasBias
      ? Math.round(Math.max(b.avgWait * clampedRatio, 5))
      : Math.round(b.avgWait)

    return {
      hour: b.hour,
      projectedWait: adjustedWait,
      sampleCount: b.sampleCount,
      adjusted: hasBias,
    }
  })
}
