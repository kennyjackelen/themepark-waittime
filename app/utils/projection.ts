import type { ForecastEntry, ProjectedWait, RideRecommendation } from './types'
import { getHourInTz, getMinuteInTz, getMinutesSinceMidnight } from './parkTime'

/**
 * Convert API forecast entries into ProjectedWait format.
 * Returns ALL hours so the chart shows the full day shape.
 */
export function forecastToProjections(
  forecast: ForecastEntry[] | undefined,
  tz?: string,
): ProjectedWait[] {
  if (!forecast || forecast.length === 0) return []

  return forecast.map((f) => {
    const time = new Date(f.time)
    return {
      hour: getHourInTz(time, tz),
      minute: getMinuteInTz(time, tz),
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
  tz?: string,
): ProjectedWait[] {
  const nowMinutes = getMinutesSinceMidnight(now, tz)
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
  now: Date = new Date(),
  tz?: string,
): number {
  if (projections.length === 0) return -1
  const nowMinutes = getMinutesSinceMidnight(now, tz)
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
  now: Date = new Date(),
  tz?: string,
): ProjectedWait[] {
  const nowMinutes = getMinutesSinceMidnight(now, tz)
  return projections.filter((p) => {
    const slotMinutes = p.hour * 60 + p.minute
    return slotMinutes >= nowMinutes
  })
}

/**
 * Format an hour number (0-23) as a short label like "4p" or "11a".
 */
function formatHourShort(h: number): string {
  const period = h >= 12 ? 'p' : 'a'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}${period}`
}

/**
 * For "bad time" recommendations, find when the wait drops meaningfully
 * and describe the timeline to the user.
 */
function describeBetterTime(
  currentWait: number,
  future: ProjectedWait[],
  now: Date,
  tz?: string,
): string {
  // Find the first slot where wait drops to at most 60% of current (and at least 10 min less)
  const threshold = Math.min(currentWait * 0.6, currentWait - 10)
  let betterSlot: ProjectedWait | null = null
  for (const p of future) {
    if (p.projectedWait <= threshold) {
      betterSlot = p
      break
    }
  }

  // Find the overall minimum future slot
  let minSlot = future[0]!
  for (const p of future) {
    if (p.projectedWait < minSlot.projectedWait) minSlot = p
  }

  const nowHour = getHourInTz(now, tz)

  if (betterSlot) {
    const hoursAway = betterSlot.hour - nowHour
    if (hoursAway <= 1) {
      return `Drops to ~${betterSlot.projectedWait} min around ${formatHourShort(betterSlot.hour)}`
    }
    return `~${betterSlot.projectedWait} min around ${formatHourShort(betterSlot.hour)} (${hoursAway}h away)`
  }

  // No big drop found — tell them about the minimum
  if (minSlot.projectedWait < currentWait - 5) {
    const hoursAway = minSlot.hour - nowHour
    if (hoursAway <= 1) {
      return `Best soon: ~${minSlot.projectedWait} min around ${formatHourShort(minSlot.hour)}`
    }
    return `Best: ~${minSlot.projectedWait} min around ${formatHourShort(minSlot.hour)} (${hoursAway}h away)`
  }

  // Wait stays high all day
  return `Stays busy — lowest ~${minSlot.projectedWait} min around ${formatHourShort(minSlot.hour)}`
}

/**
 * Classify a ride as good_time / bad_time / doesnt_matter based on
 * how the current wait compares to the forecast for the rest of the day.
 *
 * Uses both ratio AND absolute thresholds to avoid flagging trivial
 * differences (e.g. 30 min vs 25 min) as actionable.
 */
export function classifyRide(
  currentWait: number | null,
  status: string,
  projections: ProjectedWait[],
  now: Date = new Date(),
  tz?: string,
): { recommendation: RideRecommendation; reason: string } {
  if (status !== 'OPERATING' && status !== 'OPEN') return { recommendation: 'closed', reason: '' }

  const future = getFutureProjections(projections, now, tz)
  if (currentWait === null || future.length === 0) return { recommendation: 'unknown', reason: '' }

  const futureWaits = future.map((p) => p.projectedWait)
  const minFuture = Math.min(...futureWaits)
  const maxFuture = Math.max(...futureWaits)
  const avgFuture = futureWaits.reduce((a, b) => a + b, 0) / futureWaits.length
  const avg = Math.round(avgFuture)

  if (currentWait === 0) {
    if (avgFuture >= 15) {
      return { recommendation: 'good_time', reason: `Walk on now — avg ~${avg} min later` }
    }
    return { recommendation: 'good_time', reason: 'Walk on right now!' }
  }

  // Absolute and relative differences
  const absDiffFromAvg = Math.abs(currentWait - avgFuture)
  const spreadFuture = maxFuture - minFuture

  // --- "Doesn't matter" checks ---

  // Short wait all day
  if (maxFuture <= 15 && currentWait <= 15) {
    return { recommendation: 'doesnt_matter', reason: 'Short wait all day' }
  }

  // Narrow future range AND current wait is close to average
  if (spreadFuture < 10 && absDiffFromAvg < 10) {
    return { recommendation: 'doesnt_matter', reason: `Steady ~${avg} min all day` }
  }

  // --- "Good time" checks: need BOTH meaningful ratio AND absolute gap ---

  // Well below average: >25% lower AND >8 min less
  if (currentWait < avgFuture * 0.75 && currentWait < avgFuture - 8) {
    return { recommendation: 'good_time', reason: `${currentWait} min now vs ~${avg} min avg later` }
  }

  // Near day's minimum AND meaningful spread exists AND absolute gap from max
  if (currentWait <= minFuture + 5 && spreadFuture >= 15 && maxFuture - currentWait >= 10) {
    return { recommendation: 'good_time', reason: `Near today's lowest — goes up to ~${Math.round(maxFuture)} min` }
  }

  // --- "Bad time" checks: need BOTH meaningful ratio AND absolute gap ---

  // Well above average: >25% higher AND >8 min more
  if (currentWait > avgFuture * 1.25 && currentWait > avgFuture + 8) {
    const tip = describeBetterTime(currentWait, future, now, tz)
    return { recommendation: 'bad_time', reason: tip }
  }

  // Near day's maximum AND meaningful spread AND well above minimum
  if (currentWait >= maxFuture * 0.85 && spreadFuture >= 15 && currentWait - minFuture >= 10) {
    const tip = describeBetterTime(currentWait, future, now, tz)
    return { recommendation: 'bad_time', reason: tip }
  }

  // --- Marginal cases: not actionable enough to advise go/wait ---
  if (currentWait <= avgFuture) {
    return { recommendation: 'doesnt_matter', reason: `About average (~${avg} min typical)` }
  }
  return { recommendation: 'doesnt_matter', reason: `Slightly above average (~${avg} min typical)` }
}

/**
 * Interpolate the projected wait at a given time from a set of projections.
 * Returns null if no projections cover the requested time.
 */
export function interpolateProjectedWait(
  projections: ProjectedWait[],
  now: Date,
  tz?: string,
): number | null {
  if (projections.length === 0) return null
  const nowMinutes = getMinutesSinceMidnight(now, tz)

  // Find the two slots surrounding nowMinutes
  let before: ProjectedWait | null = null
  let after: ProjectedWait | null = null
  for (const p of projections) {
    const pMin = p.hour * 60 + (p.minute ?? 0)
    if (pMin <= nowMinutes) before = p
    if (pMin >= nowMinutes && !after) after = p
  }

  if (before && after) {
    const bMin = before.hour * 60 + (before.minute ?? 0)
    const aMin = after.hour * 60 + (after.minute ?? 0)
    if (bMin === aMin) return before.projectedWait
    const t = (nowMinutes - bMin) / (aMin - bMin)
    return Math.round(before.projectedWait + t * (after.projectedWait - before.projectedWait))
  }
  if (before) return before.projectedWait
  if (after) return after.projectedWait
  return null
}

/**
 * Score rides for "best ride to go on now" recommendation.
 * Higher score = better time to ride now relative to later.
 */
export function scoreRides(
  rides: { id: string; name: string; currentWait: number | null; status: string; projections: ProjectedWait[] }[],
  now: Date = new Date(),
  tz?: string,
): { id: string; score: number; reason: string }[] {
  return rides
    .filter((r) => (r.status === 'OPERATING' || r.status === 'OPEN') && r.currentWait !== null && r.currentWait >= 0)
    .map((r) => {
      const future = getFutureProjections(r.projections, now, tz)
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
