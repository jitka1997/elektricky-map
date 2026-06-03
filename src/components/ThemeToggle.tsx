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

    // Initial state: a saved override wins, otherwise follow the system.
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') setIsDark(true)
    else if (stored === 'light') setIsDark(false)
    else setIsDark(mq.matches)

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
