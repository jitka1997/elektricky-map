'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  enablePush,
  getPushStatus,
  resyncPush,
  turnedOffOnPurpose,
} from '@/lib/push'

const SNOOZE_KEY = 'notificationPromptSnoozedUntil'
const SNOOZE_DAYS = 7

const snoozedUntil = () => {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    return 0
  }
}

const snooze = (days: number) => {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86_400_000))
  } catch {
    // Private mode etc.: the prompt just comes back next time.
  }
}

// Runs when the app opens. If notifications are on for this device, quietly
// re-saves its address on the server (browsers sometimes renew it, which
// would otherwise stop notifications without anyone noticing). If they're
// off, invites the user to turn them on with a pop-up in the middle of the
// screen; "Not now" (or tapping outside it) hides it for a week.
// If they've allowed notifications in the phone's settings (after blocking
// them), one more tap is needed to register the device, so it says that.
// Nobody who turned them off on Profile gets asked again.
const NotificationPrompt = () => {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  // Allowed in settings already; only the device registration is missing.
  const [finishing, setFinishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPushStatus()
      .then((status) => {
        if (status === 'on') resyncPush().catch(console.error)
        // ("Blocked" devices report 'denied', so they're never asked here.)
        if (status !== 'off' || turnedOffOnPurpose()) return
        if (Date.now() < snoozedUntil()) return
        setFinishing(Notification.permission === 'granted')
        setShow(true)
      })
      .catch(console.error)
  }, [])

  // The Profile page has its own notification settings.
  const visible = show && pathname !== '/profile'

  // Escape closes it like "Not now".
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      snooze(SNOOZE_DAYS)
      setShow(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  if (!visible) return null

  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      const status = await enablePush()
      if (status === 'on') {
        setDone(true)
        setTimeout(() => setShow(false), 2500)
      } else if (status === 'denied') {
        // The browser won't ask again; Profile explains how to allow it in
        // settings, and this comes back as "one more tap" once they do.
        setShow(false)
      }
    } catch (e) {
      console.error(e)
      setError(
        `Couldn't turn them on: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setBusy(false)
    }
  }

  const notNow = () => {
    snooze(SNOOZE_DAYS)
    setShow(false)
  }

  return (
    // Tapping outside the box counts as "Not now", like in other apps.
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-[fade-in_0.2s_ease-out]"
      onClick={busy || done ? undefined : notNow}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-prompt-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-base-100 text-base-content rounded-box flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center shadow-2xl motion-safe:animate-[pop-in_0.25s_ease-out]"
      >
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={80}
          height={80}
          className="rounded-2xl shadow-md"
        />
        <h2 id="notification-prompt-title" className="text-2xl font-bold">
          {done
            ? "Crrrrn! You're all set"
            : finishing
              ? 'One more tap'
              : "Don't miss a Crrrrn!"}
        </h2>
        <p className="opacity-80">
          {done
            ? "You'll hear when an Električka rolls into your city."
            : finishing
              ? 'Notifications are allowed. Tap below so this phone starts getting them.'
              : 'Get a notification when an Električka rolls into your city, or is on the way.'}
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!done && (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              autoFocus
              className="btn btn-neutral btn-lg w-full"
            >
              {busy ? 'Turning on...' : 'Turn on notifications'}
            </button>
            <button
              type="button"
              onClick={notNow}
              disabled={busy}
              className="btn btn-ghost w-full"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationPrompt
