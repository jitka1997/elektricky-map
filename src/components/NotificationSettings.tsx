'use client'

import { useEffect, useState } from 'react'

import {
  disablePush,
  enablePush,
  getPushStatus,
  type PushStatus,
  resyncPush,
  sendTestPush,
} from '@/lib/push'

// Notifications are per device: this section turns them on or off for the
// phone or computer you're using right now.
const NotificationSettings = () => {
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
