import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { doc, getFirestore, setDoc, Timestamp } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase only once
let app
let analytics

// Only initialize in the browser environment
if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  analytics = getAnalytics(app)
} else {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
}

const auth = getAuth(app)
const db = getFirestore(app)

type UserEntry = {
  userId: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  lastLogin: Timestamp | null
}

export type LocationEntry = {
  userId: string
  city: string
  country: string
  createdAt: Date
}

type WriteToFirestoreType = {
  collection: string
  docId: string
  data: UserEntry | LocationEntry
}

const writeToFirestore = async ({
  collection,
  docId,
  data,
}: WriteToFirestoreType) => {
  try {
    await setDoc(doc(db, collection, docId), data, { merge: true })
    console.log('Data written to Firestore', data)
  } catch (error) {
    console.error('Error writing user data to Firestore:', error)
  }
}

export { app, auth, db, writeToFirestore, analytics }
