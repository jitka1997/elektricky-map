import React, { ReactNode } from 'react'

import Container from '@/components/Container'
import NavBar from '@/components/NavBar'

const PageWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="m-0 flex min-h-screen flex-col">
      <header className="relative z-30">
        <NavBar classname="border-b-2 h-[60px]" />
      </header>

      <main className="relative z-0 mt-[60px] grow">
        <div className="flex flex-col gap-8 py-8">{children}</div>
      </main>
      <footer>
        <Container className="py-4 text-center">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Made with love
          </p>
        </Container>
      </footer>
    </div>
  )
}

export default PageWrapper
