// src/context/AuthContext.tsx
'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import {
  User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signOut,
  signInWithPopup,
} from 'firebase/auth'
import { auth, writeToFirestore } from '@/lib/firebase'
import { serverTimestamp, Timestamp } from 'firebase/firestore'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      // Only write user data if this is a new sign-in
      if (user && sessionStorage.getItem('isNewSignIn') === 'true') {
        try {
          await writeToFirestore({
            collection: 'users',
            docId: user.uid,
            data: {
              userId: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              lastLogin: serverTimestamp() as unknown as Timestamp,
            },
          })
          // Clear the flag after successful write
          sessionStorage.removeItem('isNewSignIn')
        } catch (error) {
          console.error('Error writing user data:', error)
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      // Set a flag to indicate this is a new sign-in
      sessionStorage.setItem('isNewSignIn', 'true')
      await signInWithPopup(auth, provider)
      console.log('USER SIGNED IN', auth.currentUser)
    } catch (error) {
      console.error('Error signing in with Google:', error)
      sessionStorage.removeItem('isNewSignIn')
    }
  }

  const logout = async () => {
    console.log('SIGNING OUT', auth.currentUser)
    await signOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
