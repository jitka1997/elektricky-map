'use client'

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
// off, invites the user to turn them on; "Not now" hides it for a week.
// If they've allowed notifications in the phone's settings (after blocking
// them), one more tap is needed to register the device, so it says that.
// Nobody who turned them off on Profile gets asked again.
const NotificationPrompt = () => {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  // Allowed in settings already; only the device registration is missing.
  const [finishing, setFinishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
  if (!show || pathname === '/profile') return null

  const turnOn = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const status = await enablePush()
      if (status === 'on') {
        setMessage('Crrrrn! Notifications are on.')
        setTimeout(() => setShow(false), 2500)
      } else if (status === 'denied') {
        // The browser won't ask again; Profile explains how to allow it in
        // settings, and this card comes back as "one more tap" once they do.
        setShow(false)
      }
    } catch (e) {
      console.error(e)
      setMessage(
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
    <div className="fixed inset-x-2 bottom-2 z-[2000] mx-auto max-w-sm">
      <div className="bg-base-200 border-base-300 rounded-box text-base-content flex flex-col gap-3 border p-4 text-sm shadow-lg">
        <p>
          {message ??
            (finishing ? (
              <>
                Notifications are allowed. One more tap to start getting a{' '}
                <span className="font-semibold">Crrrrn!</span> when an
                Električka rolls into your city.
              </>
            ) : (
              <>
                Want a <span className="font-semibold">Crrrrn!</span> when an
                Električka rolls into your city? Turn on notifications.
              </>
            ))}
        </p>
        {!message?.startsWith('Crrrrn') && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={notNow}
              disabled={busy}
              className="btn btn-ghost btn-sm"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              className="btn btn-neutral btn-sm"
            >
              {busy ? 'Turning on...' : 'Turn on'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationPrompt
