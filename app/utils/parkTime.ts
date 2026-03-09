/**
 * Timezone-aware time helpers for displaying and computing park-local times.
 * All parks currently run on America/New_York, but this is parameterized
 * so we can add other timezones later.
 */

const DEFAULT_TZ = 'America/New_York'

/** Extract the hour (0-23) of a Date in a given timezone. */
export function getHourInTz(date: Date, tz: string = DEFAULT_TZ): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(date)
  )
}

/** Extract the minute (0-59) of a Date in a given timezone. */
export function getMinuteInTz(date: Date, tz: string = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    minute: 'numeric',
  }).formatToParts(date)
  return Number(parts.find((p) => p.type === 'minute')!.value)
}

/** Get hours and minutes as total minutes since midnight, in park timezone. */
export function getMinutesSinceMidnight(date: Date, tz: string = DEFAULT_TZ): number {
  return getHourInTz(date, tz) * 60 + getMinuteInTz(date, tz)
}

/** Format a Date as a short time string (e.g. "3:15 PM") in the park timezone. */
export function formatTimeInTz(
  date: Date,
  tz: string = DEFAULT_TZ,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
): string {
  return date.toLocaleTimeString([], { ...options, timeZone: tz })
}

/** Get today's date string (YYYY-MM-DD) in the park timezone. */
export function getTodayInTz(tz: string = DEFAULT_TZ): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

/** Get start-of-day as a Date for filtering (midnight in park timezone). */
export function getStartOfDayInTz(date: Date, tz: string = DEFAULT_TZ): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: tz })
  // Create a date at midnight in the target timezone by parsing the date
  // and using the timezone offset
  const [year, month, day] = dateStr.split('-').map(Number)
  // Build an approximate start-of-day — we use the formatter to get the exact offset
  const candidate = new Date(year!, month! - 1, day!, 0, 0, 0, 0)
  // Adjust: the candidate is in local time, we need it in park time
  const candidateHour = getHourInTz(candidate, tz)
  const candidateMinute = getMinuteInTz(candidate, tz)
  const offsetMs = (candidateHour * 60 + candidateMinute) * 60 * 1000
  return new Date(candidate.getTime() - offsetMs)
}
