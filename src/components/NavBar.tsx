'use client'

import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

import Container from '@/components/Container'
import { useAuth } from '@/lib/AuthContext'

type Props = {
  classname?: string
}

const NavBar = ({ classname }: Props) => {
  const { user, logout } = useAuth()

  return (
    <div
      className={twMerge(
        'fixed top-0 left-0 z-10 flex w-full bg-white print:hidden',
        classname
      )}
    >
      <Container className="flex items-center justify-between py-2">
        <div className="text-large flex gap-8 font-semibold">
          <Link href={'/login'}>Login</Link>
          <Link href={'/login'}>Nieco ine</Link>
        </div>
        <div className="text-large flex items-center gap-4 font-semibold">
          <span className="text-gray-700">
            {user?.displayName || user?.email}
          </span>
          {user?.photoURL && (
            <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200">
              <img
                src={user.photoURL}
                alt="Profile"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <button onClick={() => logout()} className="btn btn-error btn-small">
            Logout
          </button>
        </div>
      </Container>
    </div>
  )
}

export default NavBar
