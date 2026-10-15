// Firebase Admin for the API routes (server only). It bypasses the security
// rules, so every route checks who is calling with `authenticate` first.
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Initialized on first use, so building the app doesn't need the key.
const app = () => {
  const existing = getApps()[0]
  if (existing) return existing
  const key = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  return initializeApp({ credential: cert(JSON.parse(key)) })
}

export const adminDb = () => getFirestore(app())

/**
 * The signed-in user making a request (from the `Authorization: Bearer <ID
 * token>` header), or null. Only people with a user document count: the
 * security rules only let invited people create one when they sign in.
 */
export const authenticate = async (request: Request) => {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  try {
    const { uid } = await getAuth(app()).verifyIdToken(token)
    const userDoc = await adminDb().doc(`users/${uid}`).get()
    return userDoc.exists ? uid : null
  } catch {
    return null
  }
}

export const unauthorized = () =>
  Response.json({ error: 'Sign in first.' }, { status: 401 })
