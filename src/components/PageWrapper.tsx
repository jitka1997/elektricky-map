'use client'
import { usePathname } from 'next/navigation'
import React, { ReactNode } from 'react'

import Container from '@/components/Container'
import NavBar from '@/components/NavBar'

const PageWrapper = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

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
