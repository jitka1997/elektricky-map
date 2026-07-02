'use client'

import { useEffect, useState } from 'react'

// iOS Safari has no install prompt, so nudge users to add the app to their home
// screen. Shows only on iOS, only when not already installed, and is dismissible.
const InstallHint = () => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const isIOS = /iphone|ipad|ipod/i.test(nav.userAgent)
    const isStandalone =
      nav.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('installHintDismissed') === 'true'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(isIOS && !isStandalone && !dismissed)
  }, [])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem('installHintDismissed', 'true')
    setShow(false)
  }

  return (
    <div className="fixed inset-x-2 bottom-2 z-[2000] mx-auto max-w-sm">
      <div className="bg-base-200 border-base-300 rounded-box flex items-center gap-3 border p-3 text-sm shadow-lg">
        <span className="flex-1">
          Install this app: tap <span className="font-semibold">Share</span> →{' '}
          <span className="font-semibold">Add to Home Screen</span>.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="btn btn-ghost btn-xs btn-circle"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default InstallHint
