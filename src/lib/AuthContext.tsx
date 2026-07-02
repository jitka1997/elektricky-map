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

import { auth, checkUserAccess, writeUserToFirestore } from '@/lib/firebase'

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

      // Check invite-allowlist membership with a READ of the user's own doc.
      // A read resolves offline from cache (for returning users) — unlike a
      // write, which would hang while offline — and online the rules reject it
      // with permission-denied for anyone not on the guest list.
      try {
        await checkUserAccess(user.uid)
        setAuthorized(true)
      } catch (error) {
        const code = (error as { code?: string }).code
        // Only a permission-denied means "not invited"; other errors (network,
        // offline-uncached) shouldn't lock the user out — data is protected by
        // the rules regardless.
        setAuthorized(code === 'permission-denied' ? false : true)
      }

      setLoading(false)

      // Upsert profile / lastLogin in the background. Not awaited: offline this
      // write queues and would otherwise hang, and it must not block the gate.
      writeUserToFirestore({
        userId: user.uid,
        userData: {
          userId: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          lastLogin: serverTimestamp() as unknown as Timestamp,
        },
      }).catch((error) => console.error('Error writing user data:', error))
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
