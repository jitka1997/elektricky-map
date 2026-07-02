import './globals.css'

import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import InstallHint from '@/components/InstallHint'
import PageWrapper from '@/components/PageWrapper'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
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
  // Next serves the web app manifest from app/manifest.ts automatically.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Električky',
  },
  icons: {
    icon: '/favicon-32x32.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1c2b4a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash of the wrong
            colors. No value (system) leaves data-theme unset so daisyUI follows
            prefers-color-scheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme');var r=document.documentElement;if(m==='light')r.setAttribute('data-theme','caramellatte');else if(m==='dark')r.setAttribute('data-theme','luxury');}catch(e){}})();`,
          }}
        />
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
        className={`${geistSans.variable} ${geistMono.variable} bg-base-100 text-base-content antialiased`}
      >
        <ServiceWorkerRegister />
        <InstallHint />
        <AuthProvider>
          <LocationProvider>
            <PageWrapper>{children}</PageWrapper>
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
