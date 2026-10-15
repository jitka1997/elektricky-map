'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'
import { pastLocations } from '@/lib/locations'
import { checkIn } from '@/lib/push'

// Opened by tapping a check-in reminder (it links to /?checkin=1): "Still in
// Brno?" with "Yes, still here" (restarts the reminder clock without a
// duplicate entry) or "I moved" (closes and puts you in the city search).
const CheckInPrompt = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { locationData, isLoading, now } = useLocations()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const me = locationData.find((u) => u.userId === user?.uid)
  const city = me ? pastLocations(me.locations, now)[0]?.city : undefined
  const open = searchParams.get('checkin') === '1' && !isLoading && !!city

  const close = () => router.replace('/', { scroll: false })

  // Escape closes it, like tapping outside.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.replace('/', { scroll: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, router])

  if (!open) return null

  const stillHere = async () => {
    setBusy(true)
    setError(null)
    try {
      await checkIn()
      setDone(true)
      setTimeout(close, 1800)
    } catch (e) {
      setError(
        `Couldn't check in: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setBusy(false)
    }
  }

  const moved = () => {
    close()
    // Straight to logging the new city.
    setTimeout(() => {
      const search = document.querySelector<HTMLInputElement>(
        'input[name="elektricky-city-search"]'
      )
      search?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      search?.focus()
    }, 100)
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-[fade-in_0.2s_ease-out]"
      onClick={busy || done ? undefined : close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
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
        <h2 id="checkin-title" className="text-2xl font-bold">
          {done ? 'Got it, thanks!' : `Still in ${city}?`}
        </h2>
        <p className="opacity-80">
          {done
            ? "The others can see you're still there."
            : 'Let the other Električky know where you are.'}
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!done && (
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={stillHere}
              disabled={busy}
              autoFocus
              className="btn btn-neutral btn-lg w-full"
            >
              {busy ? 'Checking in...' : 'Yes, still here'}
            </button>
            <button
              type="button"
              onClick={moved}
              disabled={busy}
              className="btn btn-ghost w-full"
            >
              I moved
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CheckInPrompt
