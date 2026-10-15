'use client'
import { usePathname } from 'next/navigation'
import React, { ReactNode } from 'react'

import Container from '@/components/Container'
import NavBar from '@/components/NavBar'
import NotificationPrompt from '@/components/NotificationPrompt'
import { useAuth } from '@/lib/AuthContext'

const PageWrapper = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const { user, authorized, loading, logout } = useAuth()

  // Wait for auth (and, for a signed-in user, the allowlist check) to resolve
  // before rendering the app shell — otherwise it flashes before the gate.
  if (loading || (user && authorized === null)) {
    return (
      <div className="bg-base-100 flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  // Signed in but not on the invite allowlist — block the whole app.
  if (user && authorized === false) {
    return (
      <div className="bg-base-100 flex min-h-screen flex-col items-center justify-center p-6">
        <div className="card bg-base-200 max-w-md shadow-md">
          <div className="card-body items-center text-center">
            <h1 className="card-title text-2xl">
              You&apos;re not on the guest list 👋
            </h1>
            <p className="text-base-content/70">
              This app is invite-only. Ask the owner to add{' '}
              <span className="font-semibold break-all">{user.email}</span> to
              get access.
            </p>
            <button onClick={() => logout()} className="btn btn-neutral mt-2">
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-base-100 m-0 flex min-h-screen flex-col">
      {!isLoginPage && (
        <header className="relative z-30">
          <NavBar classname="border-b-2 h-[60px]" />
        </header>
      )}

      <main className={`relative z-0 ${!isLoginPage ? 'mt-[60px]' : ''} grow`}>
        <div className="flex flex-col gap-8 py-8">{children}</div>
      </main>
      {/* Signed-in users only: it needs to know who to save the device for. */}
      {user && !isLoginPage && <NotificationPrompt />}
      <footer>
        <Container className="py-4 text-center">
          <p className="flex flex-col justify-center text-sm text-gray-500">
            <a
              href="https://www.flaticon.com/free-icons/tram"
              title="tram icons"
            >
              Tram icon created by Freepik - Flaticon
            </a>
            &copy; {new Date().getFullYear()} Made with love
          </p>
        </Container>
      </footer>
    </div>
  )
}

export default PageWrapper
