// All supported parks are currently in Orlando (US Eastern).
// If we add parks in other timezones (e.g. California), this will need
// to become park-specific.
const PARK_TZ = 'America/New_York'

/** Get the current date string (YYYY-MM-DD) in park local time */
export function parkToday(): string {
  // en-CA locale formats dates as YYYY-MM-DD (ISO format)
  return new Date().toLocaleDateString('en-CA', { timeZone: PARK_TZ })
}

/** Get day-of-week, hour, and minute in park local time for a given Date */
export function parkTimeComponents(date: Date): { dayOfWeek: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARK_TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const weekday = parts.find(p => p.type === 'weekday')!.value
  const hour = Number(parts.find(p => p.type === 'hour')!.value)
  const minute = Number(parts.find(p => p.type === 'minute')!.value)

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dayOfWeek: dayMap[weekday]!, hour, minute }
}
