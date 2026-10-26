import {
  type DocumentData,
  FieldValue,
  Timestamp,
} from 'firebase-admin/firestore'

import { shortName } from '@/lib/names'
import { samePlace } from '@/lib/places'
import {
  adminDb,
  authenticate,
  unauthorized,
  withErrors,
} from '@/lib/server/admin'
import { sendToUsers } from '@/lib/server/push'

const HOUR = 60 * 60 * 1000

// The same place, by ID (or by name for entries from before IDs).
const sameAs = (a: DocumentData, b: DocumentData) =>
  samePlace(
    { city: String(a.city), country: String(a.country), placeId: a.placeId },
    { city: String(b.city), country: String(b.country), placeId: b.placeId }
  )

const validTimeZone = (tz: unknown) => {
  if (typeof tz !== 'string') return 'UTC'
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/**
 * Called by the app right after someone logs a new entry. Tells everyone
 * whose latest location is that city: "Ani just rolled into Brno" for an entry
 * logged for about now, or "Next stop: Brno! Ani is on the way" for a planned
 * one.
 * Entries logged for the past don't notify anyone. Each entry notifies once.
 */
async function notifyArrival(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized()

  const { locationId, timeZone } = (await request.json()) as {
    locationId?: unknown
    timeZone?: unknown
  }
  if (typeof locationId !== 'string')
    return Response.json({ error: 'Missing locationId.' }, { status: 400 })

  const db = adminDb()
  const userRef = db.collection('users').doc(userId)
  const entry = await userRef.collection('locations').doc(locationId).get()
  if (!entry.exists)
    return Response.json({ error: 'Entry not found.' }, { status: 404 })

  const loc = entry.data()!
  const time = (loc.createdAt as Timestamp).toMillis()
  const now = Date.now()
  const kind =
    time > now + 10 * 60 * 1000
      ? 'planned'
      : time >= now - 3 * HOUR
        ? 'arrived'
        : null
  if (!kind) return Response.json({ sent: 0 })

  // Only once per entry, even if the app calls again.
  try {
    await db
      .collection('notifiedEntries')
      .doc(`${userId}_${locationId}`)
      .create({ at: FieldValue.serverTimestamp() })
  } catch {
    return Response.json({ sent: 0 })
  }

  // Everyone else whose most recent entry (up to now) is in that city.
  const users = await db.collection('users').get()
  const nowTs = Timestamp.fromMillis(now)
  const recipients: string[] = []
  await Promise.all(
    users.docs
      .filter((u) => u.id !== userId)
      .map(async (u) => {
        const latest = await u.ref
          .collection('locations')
          .where('createdAt', '<=', nowTs)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get()
        const current = latest.docs[0]?.data()
        if (current && sameAs(current, loc)) recipients.push(u.id)
      })
  )
  if (!recipients.length) return Response.json({ sent: 0 })

  const me = users.docs.find((u) => u.id === userId)?.data() ?? {}
  const name =
    shortName(me.displayName ?? null, me.customName) || 'An Električka'
  const city = String(loc.city).trim()

  const sent =
    kind === 'arrived'
      ? await sendToUsers(
          recipients,
          {
            title: `Crrrrn! ${name} just rolled into ${city}`,
            body: 'Two Električky on the same tracks. Time to meet up?',
            url: '/',
            tag: `arrival-${userId}`,
          },
          12 * 60 * 60
        )
      : await sendToUsers(
          recipients,
          {
            title: `Next stop: ${city}! ${name} is on the way`,
            body: `Arriving ${new Date(time).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              timeZone: validTimeZone(timeZone),
            })}. Keep a seat free!`,
            url: '/',
            tag: `planned-${userId}-${locationId}`,
          },
          3 * 24 * 60 * 60
        )
  return Response.json({ sent })
}

export const POST = withErrors(notifyArrival)
