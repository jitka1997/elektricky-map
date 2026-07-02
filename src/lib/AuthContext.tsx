// src/context/AuthContext.tsx
'use client'

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth'
import { serverTimestamp, Timestamp } from 'firebase/firestore'
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

import { auth, writeUserToFirestore } from '@/lib/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  // Whether the signed-in user is on the invite allowlist: null while unknown
  // (or signed out), true if allowed, false if not invited.
  authorized: boolean | null
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (!user) {
        setAuthorized(null)
        setLoading(false)
        return
      }

      // Upsert the user doc on every sign-in. This doubles as the allowlist
      // check: the rules only permit this write for invited users, so a
      // permission-denied here means the user isn't on the guest list.
      try {
        await writeUserToFirestore({
          userId: user.uid,
          userData: {
            userId: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: serverTimestamp() as unknown as Timestamp,
          },
        })
        setAuthorized(true)
      } catch (error) {
        const code = (error as { code?: string }).code
        if (code === 'permission-denied') {
          setAuthorized(false)
        } else {
          // Network/other error — don't lock the user out over it; the data is
          // protected by the rules regardless.
          console.error('Error writing user data:', error)
          setAuthorized(true)
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      console.log('USER SIGNED IN', auth.currentUser)
    } catch (error) {
      console.error('Error signing in with Google:', error)
    }
  }

  const logout = async () => {
    console.log('SIGNING OUT', auth.currentUser)
    await signOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, authorized, signInWithGoogle, logout }}
    >
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
