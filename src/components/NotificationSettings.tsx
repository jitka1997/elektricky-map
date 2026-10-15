'use client'

import { useEffect, useState } from 'react'

import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'
import {
  disablePush,
  enablePush,
  getPushStatus,
  type PushStatus,
  resyncPush,
  saveReminderDays,
  sendTestPush,
} from '@/lib/push'
import { DEFAULT_REMINDER_DAYS, REMINDER_OPTIONS } from '@/lib/reminders'

// Notifications are per device: this section turns them on or off for the
// phone or computer you're using right now.
const NotificationSettings = () => {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // "Remind me to check in" is per person (all their devices), saved on the
  // server; the live data shows the saved value.
  const { user } = useAuth()
  const { locationData } = useLocations()
  const savedReminderDays =
    locationData.find((u) => u.userId === user?.uid)?.reminderDays ??
    DEFAULT_REMINDER_DAYS
  const [reminderDays, setReminderDays] = useState<number | null>(null)
  const shownReminderDays = reminderDays ?? savedReminderDays
  const [reminderError, setReminderError] = useState<string | null>(null)

  const changeReminderDays = async (days: number) => {
    setReminderDays(days)
    setReminderError(null)
    try {
      await saveReminderDays(days)
    } catch (e) {
      setReminderDays(null)
      setReminderError(
        `Couldn't save: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  useEffect(() => {
    getPushStatus()
      .then((status) => {
        setStatus(status)
        if (status === 'on')
          resyncPush().catch((e) =>
            setError(`Couldn't sync this device: ${e.message}`)
          )
      })
      .catch(() => setStatus('unsupported'))
  }, [])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await action()
    } catch (e) {
      console.error(e)
      // Show the reason: it's what tells us what to fix.
      setError(
        `Something went wrong: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setBusy(false)
    }
  }

  const turnOn = () => run(async () => setStatus(await enablePush()))
  const turnOff = () =>
    run(async () => {
      await disablePush()
      setStatus('off')
    })
  const test = () =>
    run(async () => {
      const sent = await sendTestPush()
      setMessage(
        sent
          ? 'Sent. It should pop up in a few seconds.'
          : "Couldn't reach this device. Turn notifications off and on again."
      )
    })

  return (
    <section className="card bg-base-200 shadow-md">
      <div className="card-body gap-3">
        <h2 className="card-title">Notifications</h2>
        <p className="text-sm opacity-80">
          Get a notification when a friend arrives in your city or plans to
          come. They&apos;re set per device, so turn them on on each phone or
          computer you use.
        </p>

        {status === 'loading' && (
          <span className="loading loading-spinner loading-sm" />
        )}
        {status === 'needs-install' && (
          <p className="text-sm">
            On iPhone, notifications only work in the app on your Home Screen.
            Tap <b>Share → Add to Home Screen</b>, then open Električky from
            there and come back here.
          </p>
        )}
        {status === 'unsupported' && (
          <p className="text-sm">This browser can&apos;t show notifications.</p>
        )}
        {status === 'dev' && (
          <p className="text-sm">
            Notifications need the service worker, which only runs in the
            production build (<code>npm run build && npm start</code>).
          </p>
        )}
        {status === 'denied' && (
          <p className="text-sm">
            Notifications are blocked for Električky. Allow them in your
            phone&apos;s settings (or the browser&apos;s site settings), then
            reload this page.
          </p>
        )}
        {status === 'on' && (
          <p className="text-sm font-semibold">On for this device.</p>
        )}

        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Remind me to check in</span>
          <select
            className="select select-sm w-auto"
            value={shownReminderDays}
            onChange={(e) => changeReminderDays(Number(e.target.value))}
          >
            {REMINDER_OPTIONS.map(([days, label]) => (
              <option key={days} value={days}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="-mt-1 text-xs opacity-70">
          &ldquo;Still in Brno?&rdquo; around 6 pm your time, only if you
          haven&apos;t logged anything in that time. Goes to every device where
          notifications are on.
        </p>
        {reminderError && (
          <p className="text-sm text-red-500">{reminderError}</p>
        )}

        {message && <p className="text-sm">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {(status === 'off' || status === 'on') && (
          <div className="card-actions justify-end">
            {status === 'off' ? (
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="btn btn-neutral"
              >
                {busy ? 'Turning on...' : 'Turn on notifications'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={turnOff}
                  disabled={busy}
                  className="btn btn-ghost"
                >
                  Turn off
                </button>
                <button
                  type="button"
                  onClick={test}
                  disabled={busy}
                  className="btn btn-outline"
                >
                  Send me a test
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default NotificationSettings
