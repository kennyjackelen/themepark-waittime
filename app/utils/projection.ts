import type { ForecastEntry, ProjectedWait, RideRecommendation } from './types'

/**
 * Convert API forecast entries into ProjectedWait format.
 * Returns ALL hours so the chart shows the full day shape.
 */
export function forecastToProjections(
  forecast: ForecastEntry[] | undefined,
): ProjectedWait[] {
  if (!forecast || forecast.length === 0) return []

  return forecast.map((f) => {
    const time = new Date(f.time)
    return {
      hour: time.getHours(),
      minute: time.getMinutes(),
      projectedWait: f.waitTime,
    }
  })
}

/**
 * Typical theme park demand curve as fraction of peak wait (0–1).
 * Maps progress through the operating day (0 = open, 1 = close) to a multiplier.
 * Shape: low at open, ramps to peak around 35-45% of the day, slight afternoon
 * dip, secondary peak, then tapers to close.
 */
const DEMAND_CURVE: [number, number][] = [
  [0.00, 0.30],
  [0.08, 0.50],
  [0.15, 0.70],
  [0.25, 0.90],
  [0.35, 1.00],
  [0.45, 0.95],
  [0.55, 0.85],
  [0.65, 0.90],
  [0.75, 0.80],
  [0.85, 0.60],
  [0.95, 0.40],
  [1.00, 0.25],
]

function interpolateCurve(progress: number): number {
  if (progress <= 0) return DEMAND_CURVE[0]![1]
  if (progress >= 1) return DEMAND_CURVE[DEMAND_CURVE.length - 1]![1]
  for (let i = 1; i < DEMAND_CURVE.length; i++) {
    const [x0, y0] = DEMAND_CURVE[i - 1]!
    const [x1, y1] = DEMAND_CURVE[i]!
    if (progress <= x1) {
      const t = (progress - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return DEMAND_CURVE[DEMAND_CURVE.length - 1]![1]
}

/**
 * Generate a synthetic forecast for rides that lack API forecast data.
 * Uses the current wait to estimate peak wait, then applies a demand curve
 * across the park's operating hours.
 */
export function generateSyntheticForecast(
  currentWait: number,
  openHour: number,
  closeHour: number,
  now: Date = new Date(),
): ProjectedWait[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openHour * 60
  const closeMinutes = closeHour * 60
  const dayLength = closeMinutes - openMinutes
  if (dayLength <= 0) return []

  // Where are we in the day right now?
  const nowProgress = Math.max(0, Math.min(1, (nowMinutes - openMinutes) / dayLength))
  const nowDemand = interpolateCurve(nowProgress)

  // Estimate peak wait: currentWait = peakWait * nowDemand
  // Clamp so we don't wildly extrapolate from low-demand times
  const peakWait = nowDemand > 0.2 ? currentWait / nowDemand : currentWait * 2

  const projections: ProjectedWait[] = []
  for (let minutes = openMinutes; minutes <= closeMinutes; minutes += 60) {
    const progress = (minutes - openMinutes) / dayLength
    const demand = interpolateCurve(progress)
    projections.push({
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      projectedWait: Math.round(Math.max(peakWait * demand, 5)),
    })
  }
  return projections
}

/**
 * Find which forecast slot is closest to "now" (the live bar).
 * Returns the index into the projections array, or -1 if none match.
 */
export function getCurrentSlotIndex(
  projections: ProjectedWait[],
  now: Date = new Date()
): number {
  if (projections.length === 0) return -1
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < projections.length; i++) {
    const slotMinutes = projections[i]!.hour * 60 + projections[i]!.minute
    const dist = Math.abs(slotMinutes - nowMinutes)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  // Only mark as current if within 60 minutes
  return bestDist <= 60 ? bestIdx : -1
}

/**
 * Get future projections only (for classification and scoring).
 */
export function getFutureProjections(
  projections: ProjectedWait[],
  now: Date = new Date()
): ProjectedWait[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return projections.filter((p) => {
    const slotMinutes = p.hour * 60 + p.minute
    return slotMinutes >= nowMinutes
  })
}

/**
 * Classify a ride as good_time / bad_time / doesnt_matter based on
 * how the current wait compares to the forecast for the rest of the day.
 */
export function classifyRide(
  currentWait: number | null,
  status: string,
  projections: ProjectedWait[]
): RideRecommendation {
  if (status !== 'OPERATING' && status !== 'OPEN') return 'closed'

  const future = getFutureProjections(projections)
  if (currentWait === null || future.length === 0) return 'unknown'

  const futureWaits = future.map((p) => p.projectedWait)
  const minFuture = Math.min(...futureWaits)
  const maxFuture = Math.max(...futureWaits)
  const avgFuture = futureWaits.reduce((a, b) => a + b, 0) / futureWaits.length

  // If the ride never really has long waits (max forecast under 15 min), doesn't matter
  if (maxFuture <= 15 && currentWait <= 15) return 'doesnt_matter'

  // If the ride is always long and doesn't improve much, doesn't matter
  if (minFuture > 0 && maxFuture / minFuture < 1.3 && currentWait >= 30) return 'doesnt_matter'

  // Good time: current wait is notably below average forecast
  if (currentWait < avgFuture * 0.7) return 'good_time'

  // Good time: current wait is within 10% of the day's forecast minimum
  if (currentWait <= minFuture * 1.1) return 'good_time'

  // Bad time: current wait is notably above average
  if (currentWait > avgFuture * 1.3) return 'bad_time'

  // Bad time: current wait is near the day's forecast maximum
  if (currentWait >= maxFuture * 0.85) return 'bad_time'

  // Moderate — lean toward good if below average, bad if above
  if (currentWait <= avgFuture) return 'good_time'
  return 'bad_time'
}

/**
 * Score rides for "best ride to go on now" recommendation.
 * Higher score = better time to ride now relative to later.
 */
export function scoreRides(
  rides: { id: string; name: string; currentWait: number | null; status: string; projections: ProjectedWait[] }[]
): { id: string; score: number; reason: string }[] {
  return rides
    .filter((r) => (r.status === 'OPERATING' || r.status === 'OPEN') && r.currentWait !== null && r.currentWait >= 0)
    .map((r) => {
      const future = getFutureProjections(r.projections)
      const futureWaits = future.map((p) => p.projectedWait)
      if (futureWaits.length === 0) {
        return { id: r.id, score: 0, reason: 'No forecast data' }
      }
      const avgFuture = futureWaits.reduce((a, b) => a + b, 0) / futureWaits.length
      const minFuture = Math.min(...futureWaits)

      let score: number
      if (avgFuture <= 5) {
        score = 1
      } else {
        score = (avgFuture - r.currentWait!) / Math.max(avgFuture, 1) * 100
      }

      if (r.currentWait! <= minFuture) {
        score += 20
      }

      let reason = ''
      if (r.currentWait === 0) {
        reason = 'Walk on right now!'
      } else if (score > 60) {
        reason = `${r.currentWait} min now vs ~${Math.round(avgFuture)} min avg later`
      } else if (score > 30) {
        reason = `Shorter than usual (${r.currentWait} min)`
      } else {
        reason = `${r.currentWait} min wait`
      }

      return { id: r.id, score, reason }
    })
    .sort((a, b) => b.score - a.score)
}
