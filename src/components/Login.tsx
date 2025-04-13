// src/components/Login.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import GoogleButton from 'react-google-button'

import { useAuth } from '@/lib/AuthContext'

const Login = () => {
  const [error, setError] = useState('')
  const [isSignedIn, setIsSignedIn] = useState(false)
  const { signInWithGoogle, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isSignedIn && user) {
      router.push('/')
    }
  }, [isSignedIn, user, router])

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
      setIsSignedIn(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-6 text-2xl font-bold">Sign In</h2>

      {error && (
        <div className="mb-4 rounded bg-red-100 p-3 text-red-700">{error}</div>
      )}

      <GoogleButton onClick={async () => handleGoogleSignIn()} />
    </div>
  )
}

export default Login
