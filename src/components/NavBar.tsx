'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { twMerge } from 'tailwind-merge'

import Container from '@/components/Container'
import ThemeToggle from '@/components/ThemeToggle'
import UserIcon from '@/components/UserIcon'
import { useAuth } from '@/lib/AuthContext'

type Props = {
  classname?: string
}

const NavBar = ({ classname }: Props) => {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  // Highlight the link matching the current route: full opacity + bold for the
  // active tab, dimmed for the rest. No color change, so it stays on-theme.
  const linkClass = (href: string) =>
    twMerge(
      'opacity-60 transition-opacity hover:opacity-100',
      pathname === href && 'font-bold opacity-100'
    )

  return (
    <div
      className={twMerge(
        'fixed top-0 left-0 z-10 flex w-full print:hidden',
        classname
      )}
    >
      <Container className="text-base-content bg-base-200 flex items-center justify-between py-2 shadow-md">
        <div className="text-large flex gap-8 font-semibold">
          <Link href={'/'} className={linkClass('/')}>
            Map
          </Link>
          <Link href={'/history'} className={linkClass('/history')}>
            History
          </Link>
        </div>
        <div className="text-large flex items-center gap-4 font-semibold">
          <ThemeToggle />
          <span className="hidden sm:inline">
            {user?.displayName || user?.email}
          </span>
          <UserIcon photoURL={user?.photoURL} />
          <button onClick={() => logout()} className="btn btn-error btn-small">
            Logout
          </button>
        </div>
      </Container>
    </div>
  )
}

export default NavBar
