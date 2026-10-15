'use client'

import { auth } from '@/lib/firebase'

// Calls one of our API routes as the signed-in user.
const callApi = async (path: string, method: string, body: unknown) => {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Not signed in')
  const response = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }))
    throw new Error(
      error ??
        (response.status >= 500
          ? `Server error (${response.status}). The Vercel logs say why.`
          : `Request failed (${response.status})`)
    )
  }
  return response.json()
}

export type PushStatus =
  | 'unsupported' // this browser can't do push
  | 'needs-install' // iPhone/iPad: only works from the home-screen app
  | 'dev' // the service worker only runs in the production build
  | 'denied' // the user blocked notifications
  | 'off'
  | 'on'

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac with a touch screen.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true

const currentSubscription = async () => {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Whether notifications are on for this device, or why they can't be. */
export const getPushStatus = async (): Promise<PushStatus> => {
  if (isIos() && !isInstalled()) return 'needs-install'
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  )
    return 'unsupported'
  if (process.env.NODE_ENV !== 'production') return 'dev'
  if (Notification.permission === 'denied') return 'denied'
  return (await currentSubscription()) ? 'on' : 'off'
}

// The VAPID public key as the bytes the push service expects.
const applicationServerKey = () => {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
  const base64 = (key + '='.repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/** Asks for permission and registers this device. Returns the new status. */
export const enablePush = async (): Promise<PushStatus> => {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    return permission === 'denied' ? 'denied' : 'off'
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(),
  })
  await callApi('/api/push/devices', 'POST', {
    subscription: subscription.toJSON(),
  })
  return 'on'
}

/**
 * If this device is subscribed, saves the subscription on the server again.
 * Fixes a phone that thinks it's on while the server never saved it (or
 * removed it), and picks up a subscription the browser renewed by itself.
 */
export const resyncPush = async () => {
  const subscription = await currentSubscription()
  if (!subscription) return
  await callApi('/api/push/devices', 'POST', {
    subscription: subscription.toJSON(),
  })
}

/** Stops notifications on this device. */
export const disablePush = async () => {
  const subscription = await currentSubscription()
  if (!subscription) return
  await callApi('/api/push/devices', 'DELETE', {
    endpoint: subscription.endpoint,
  }).catch(() => {})
  await subscription.unsubscribe()
}

/** Sends a test notification to all of your devices; returns how many. */
export const sendTestPush = async (): Promise<number> =>
  (await callApi('/api/push/test', 'POST', {})).sent

/**
 * Lets friends in that city know about a new entry ("Ani just arrived in
 * Brno" / "Ani is coming to Brno"). Fire and forget: the entry is saved
 * either way.
 */
export const notifyNewEntry = (locationId: string) => {
  callApi('/api/notify/arrival', 'POST', {
    locationId,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).catch((error) => console.error('Arrival notification failed:', error))
}
