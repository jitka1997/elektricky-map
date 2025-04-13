// src/components/Login.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import GoogleButton from 'react-google-button'
import { useRouter } from 'next/navigation'

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
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Sign In</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <GoogleButton onClick={async () => handleGoogleSignIn()} />
    </div>
  )
}

export default Login
