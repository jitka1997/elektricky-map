import type { Timestamp } from 'firebase/firestore'

/** Normalize a Firestore Timestamp or JS Date to a Date. */
export const toDate = (value: Date | Timestamp): Date =>
  value instanceof Date ? value : value.toDate()

/** e.g. "16 Jun 2026" (day-month-year, Safari-safe — no string re-parsing). */
export const formatDate = (value: Date | Timestamp): string =>
  toDate(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

/** e.g. "15:30". */
export const formatTime = (value: Date | Timestamp): string =>
  toDate(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Format a Date for a `datetime-local` input value (local time, minutes). */
export const toDateTimeLocal = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
