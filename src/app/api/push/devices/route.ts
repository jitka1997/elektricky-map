import { FieldValue } from 'firebase-admin/firestore'

import { isValidTimeZone } from '@/lib/reminders'
import {
  adminDb,
  authenticate,
  unauthorized,
  withErrors,
} from '@/lib/server/admin'
import { deviceId, devicesOf } from '@/lib/server/push'

type Subscription = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

// Turn notifications on for this device (or re-save it when the app opens):
// save its push subscription.
async function saveDevice(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized()

  const { subscription, timeZone } = (await request.json()) as {
    subscription?: Subscription
    timeZone?: unknown
  }
  const { endpoint, keys } = subscription ?? {}
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    typeof keys?.p256dh !== 'string' ||
    typeof keys?.auth !== 'string'
  ) {
    return Response.json({ error: 'Invalid subscription.' }, { status: 400 })
  }

  await devicesOf(userId)
    .doc(deviceId(endpoint))
    .set({
      subscription: {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
      userAgent: request.headers.get('user-agent') ?? null,
      createdAt: FieldValue.serverTimestamp(),
    })
  // Reminders arrive in the evening of wherever the phone is. Saved every
  // time the app opens, so it follows people when they travel.
  if (isValidTimeZone(timeZone))
    await adminDb().doc(`users/${userId}`).update({ timeZone })
  return Response.json({ ok: true })
}

// Turn notifications off for this device.
async function removeDevice(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized()

  const { endpoint } = (await request.json()) as { endpoint?: unknown }
  if (typeof endpoint !== 'string')
    return Response.json({ error: 'Missing endpoint.' }, { status: 400 })

  await devicesOf(userId).doc(deviceId(endpoint)).delete()
  return Response.json({ ok: true })
}

export const POST = withErrors(saveDevice)
export const DELETE = withErrors(removeDevice)
