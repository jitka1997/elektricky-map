import { timingSafeEqual } from 'node:crypto'

import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import {
  DEFAULT_REMINDER_DAYS,
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  REMINDER_HOURS,
} from '@/lib/reminders'
import { adminDb, withErrors } from '@/lib/server/admin'
import { devicesOf, sendToUsers } from '@/lib/server/push'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// Due a bit early, so "every 3 days" doesn't slip a day when someone logged
// later in the evening than the reminder goes out.
const SLACK = 6 * HOUR

// Only the hourly GitHub Action may call this (it sends CRON_SECRET).
const isScheduler = (request: Request) => {
  const secret = process.env.CRON_SECRET
  const given = request.headers
    .get('authorization')
    ?.match(/^Bearer (.+)$/)?.[1]
  if (!secret || !given) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

const hourIn = (timeZone: string, now: number) =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone,
    }).format(now)
  )

/**
 * Runs every hour. Sends "Still in Brno?" to everyone who is in their evening
 * right now, hasn't logged or checked in for their reminder interval, hasn't
 * had a reminder within it, and has notifications on somewhere.
 */
async function sendReminders(request: Request) {
  if (!isScheduler(request))
    return Response.json({ error: 'Not allowed.' }, { status: 401 })

  const db = adminDb()
  const now = Date.now()
  const users = await db.collection('users').get()
  let due = 0
  let sent = 0

  for (const user of users.docs) {
    const data = user.data()
    const days: number = data.reminderDays ?? DEFAULT_REMINDER_DAYS
    if (!days) continue
    const interval = days * DAY - SLACK

    const timeZone = isValidTimeZone(data.timeZone)
      ? data.timeZone
      : DEFAULT_TIME_ZONE
    const hour = hourIn(timeZone, now)
    if (hour < REMINDER_HOURS.from || hour >= REMINDER_HOURS.until) continue

    const lastReminder = (
      data.lastReminderAt as Timestamp | undefined
    )?.toMillis()
    if (lastReminder && now - lastReminder < interval) continue

    const latest = (
      await user.ref
        .collection('locations')
        .where('createdAt', '<=', Timestamp.fromMillis(now))
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
    ).docs[0]
    const lastActivity = Math.max(
      (latest?.get('createdAt') as Timestamp | undefined)?.toMillis() ?? 0,
      (data.lastCheckIn as Timestamp | undefined)?.toMillis() ?? 0
    )
    if (now - lastActivity < interval) continue
    if ((await devicesOf(user.id).limit(1).get()).empty) continue

    due++
    const city = latest?.get('city') as string | undefined
    sent += await sendToUsers(
      [user.id],
      city
        ? {
            title: `Still in ${city.trim()}?`,
            body: 'Crrrrn! Tap to check in, or log where you are now.',
            url: '/?checkin=1',
            tag: 'checkin',
          }
        : {
            title: 'Where are you these days?',
            body: 'Crrrrn! Log your city so the others can see you on the map.',
            url: '/',
            tag: 'checkin',
          },
      12 * 60 * 60
    )
    // Even if sending failed, so a broken device can't cause a reminder
    // every hour.
    await user.ref.update({ lastReminderAt: FieldValue.serverTimestamp() })
  }

  // Counts only: this response shows up in the public GitHub Actions log.
  return Response.json({ checked: users.size, due, sent })
}

export const POST = withErrors(sendReminders)
