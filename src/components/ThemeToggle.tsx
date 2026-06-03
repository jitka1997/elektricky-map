'use client'

import { useEffect, useState } from 'react'

// daisyUI themes configured in globals.css.
const LIGHT_THEME = 'caramellatte'
const DARK_THEME = 'luxury'
const STORAGE_KEY = 'theme'

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    // Initial state: a saved override wins, otherwise follow the system. This
    // reads client-only state (localStorage/matchMedia) that isn't available
    // during SSR, so it must run here rather than in a lazy initializer.
    const stored = localStorage.getItem(STORAGE_KEY)
    const initialDark =
      stored === 'dark' ? true : stored === 'light' ? false : mq.matches
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(initialDark)

    // Keep syncing to the browser even after a manual selection: when the OS
    // theme changes, drop the override and follow the system again.
    const onChange = (e: MediaQueryListEvent) => {
      localStorage.removeItem(STORAGE_KEY)
      document.documentElement.removeAttribute('data-theme')
      setIsDark(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    // An explicit choice overrides the system theme from now on.
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    document.documentElement.setAttribute(
      'data-theme',
      next ? DARK_THEME : LIGHT_THEME
    )
  }

  return (
    <label
      className="swap swap-rotate btn btn-ghost btn-circle btn-sm"
      aria-label="Toggle light/dark theme"
    >
      <input type="checkbox" checked={isDark} onChange={toggle} />
      <span className="swap-off text-lg">🌙</span>
      <span className="swap-on text-lg">☀️</span>
    </label>
  )
}

export default ThemeToggle
