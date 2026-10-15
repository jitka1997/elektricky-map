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

  const badge = {
    on: ['badge-success', 'On'],
    off: ['', 'Off'],
    denied: ['badge-error', 'Blocked'],
  }[status as 'on' | 'off' | 'denied']

  return (
    <section className="card bg-base-200 shadow-md">
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="card-title">Notifications</h2>
            <p className="text-sm opacity-80">
              Know when another Električka rolls into your city.
            </p>
          </div>
          {status === 'loading' ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            badge && (
              <span className={`badge shrink-0 ${badge[0]}`}>{badge[1]}</span>
            )
          )}
        </div>

        {status === 'needs-install' && (
          <p className="text-sm">
            On iPhone they only work in the app on your Home Screen:{' '}
            <b>Share → Add to Home Screen</b>, then open it from there.
          </p>
        )}
        {status === 'unsupported' && (
          <p className="text-sm">This browser can&apos;t show notifications.</p>
        )}
        {status === 'dev' && (
          <p className="text-sm">
            Only in the production build (
            <code>npm run build && npm start</code>).
          </p>
        )}
        {status === 'denied' && (
          <p className="text-sm">
            Blocked on this device. Allow notifications for Električky in your
            phone&apos;s settings (or the browser&apos;s site settings), then
            reload this page.
          </p>
        )}

        {status === 'off' && (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              className="btn btn-neutral"
            >
              {busy ? 'Turning on...' : 'Turn on notifications'}
            </button>
            <p className="text-xs opacity-70">
              Turn them on on every phone or computer you use.
            </p>
          </div>
        )}

        {status === 'on' && (
          <>
            {/* What you get: all on, only the reminders can be tuned. */}
            <ul className="bg-base-100 rounded-field divide-base-200 divide-y text-sm">
              <li className="flex items-center justify-between gap-3 px-4 py-3">
                <span>An Električka rolls into your city</span>
                <span className="shrink-0 text-xs opacity-60">Always</span>
              </li>
              <li className="flex items-center justify-between gap-3 px-4 py-3">
                <span>An Električka is on its way to you</span>
                <span className="shrink-0 text-xs opacity-60">Always</span>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>You haven&apos;t logged a city in a while</span>
                <select
                  aria-label="Check-in reminders"
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
              </li>
            </ul>
            {reminderError && (
              <p className="text-sm text-red-500">{reminderError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={test}
                disabled={busy}
                className="btn btn-outline btn-sm"
              >
                Send me a test
              </button>
              <button
                type="button"
                onClick={turnOff}
                disabled={busy}
                className="btn btn-ghost btn-sm"
              >
                Turn off on this device
              </button>
            </div>
          </>
        )}

        {message && <p className="text-sm">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </section>
  )
}

export default NotificationSettings
