// Sending web push notifications (server only). Each device that turned
// notifications on is a document in `users/{id}/devices`.
import { createHash } from 'node:crypto'

import webpush, { type PushSubscription } from 'web-push'

import { adminDb } from '@/lib/server/admin'

/** What the service worker (public/sw.js) shows. */
export type PushMessage = {
  title: string
  body: string
  // Page to open when the notification is tapped.
  url?: string
  // Notifications with the same tag replace each other.
  tag?: string
}

let configured = false
const configure = () => {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject)
    throw new Error('VAPID keys are not set')
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

/** A stable id per device, so subscribing again replaces the old entry. */
export const deviceId = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex').slice(0, 32)

export const devicesOf = (userId: string) =>
  adminDb().collection('users').doc(userId).collection('devices')

/** Sends to every device of these users; returns how many got it. */
export const sendToUsers = async (
  userIds: string[],
  message: PushMessage,
  ttlSeconds = 24 * 60 * 60
) => {
  configure()
  let sent = 0
  await Promise.all(
    userIds.map(async (userId) => {
      const devices = await devicesOf(userId).get()
      await Promise.all(
        devices.docs.map(async (device) => {
          try {
            await webpush.sendNotification(
              device.get('subscription') as PushSubscription,
              JSON.stringify(message),
              { TTL: ttlSeconds }
            )
            sent++
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode
            // The device turned notifications off or the app was removed.
            if (status === 404 || status === 410) await device.ref.delete()
            else console.error('Push failed with status', status)
          }
        })
      )
    })
  )
  return sent
}
