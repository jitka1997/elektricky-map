import './globals.css'

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import PageWrapper from '@/components/PageWrapper'
import { AuthProvider } from '@/lib/AuthContext'
import { LocationProvider } from '@/lib/LocationContext'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Električky Map',
  description: 'Best tool to see where your fellow Električky are',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme="caramellatte">
      <head>
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon.16x16png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <LocationProvider>
            <PageWrapper>{children}</PageWrapper>
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
