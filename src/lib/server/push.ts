// Sending web push notifications (server only). Each device that turned
// notifications on is a document in `users/{id}/devices`.
import { createHash } from 'node:crypto'
import https from 'node:https'

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

// Connections to the push services can take ~1 s to open on a slow network,
// and Node's default gives each address only 250 ms before giving up
// (ETIMEDOUT). Allow more, and reuse connections between sends.
const agent = new https.Agent({
  keepAlive: true,
  autoSelectFamilyAttemptTimeout: 2000,
})

/** Sends one notification, retrying once if the network (not the push
 * service) failed. */
const send = async (
  subscription: PushSubscription,
  payload: string,
  ttlSeconds: number
) => {
  const options = { TTL: ttlSeconds, agent, timeout: 10_000 }
  try {
    return await webpush.sendNotification(subscription, payload, options)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    return await webpush.sendNotification(subscription, payload, options)
  }
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
            await send(
              device.get('subscription') as PushSubscription,
              JSON.stringify(message),
              ttlSeconds
            )
            sent++
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode
            // The device turned notifications off or the app was removed.
            if (status === 404 || status === 410) await device.ref.delete()
            else
              console.error(
                'Push failed:',
                status ?? (error as { code?: string }).code
              )
          }
        })
      )
    })
  )
  return sent
}
