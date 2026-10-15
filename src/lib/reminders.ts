// Check-in reminders: "Still in Brno?" when someone hasn't logged anything for
// a while. Shared by the Profile setting and the server that sends them.

/** Choices on Profile, in days (0 = off). */
export const REMINDER_OPTIONS: [number, string][] = [
  [0, 'Off'],
  [1, 'Every day'],
  [3, 'Every 3 days'],
  [7, 'Every week'],
]

/** For anyone who never changed the setting. */
export const DEFAULT_REMINDER_DAYS = 3

/** Until a device has reported its own time zone. */
export const DEFAULT_TIME_ZONE = 'Europe/Bratislava'

/** Reminders go out in the evening, in each person's own time zone. */
export const REMINDER_HOURS = { from: 18, until: 22 }

export const isValidTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
