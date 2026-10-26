import { getAnalytics } from 'firebase/analytics'
import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  type QueryDocumentSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'

import { TravelMode } from '@/lib/travel'
import type { LocationData } from '@/lib/types'

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

// In the browser, enable IndexedDB offline persistence (multi-tab safe) so
// previously-loaded data is available offline. On the server, a plain instance.
const db =
  typeof window !== 'undefined'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    : getFirestore(app)

// Read the user's own doc to check invite-allowlist membership. Online, the
// rules reject this with permission-denied for users who aren't invited;
// offline, it resolves from the local cache for returning (invited) users.
const checkUserAccess = async (userId: string) => {
  await getDoc(doc(db, 'users', userId))
}

type UserEntry = {
  userId: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  lastLogin: Timestamp | null
  // User-chosen overrides (set on the profile page). Kept separate from the
  // Google displayName/photoURL, which are refreshed on every sign-in.
  customName?: string | null
  customPhoto?: string | null
  reminderDays?: number | null
}

export type LocationEntry = {
  // Firestore document id — present on entries read back from Firestore,
  // absent when constructing a new entry to write.
  id?: string
  userId: string
  city: string
  country: string
  latitude: number
  longitude: number
  createdAt: Date | Timestamp
  // How the user travelled to reach this location. Optional: older entries
  // (logged before this feature) won't have it.
  travelMode?: TravelMode
  // Which place this is on the map, e.g. "osm:R3687140", and its country
  // ("GB"). Places are compared by this ID, so a renamed or differently
  // spelled place still counts as the same one. Older entries don't have it.
  placeId?: string
  countryCode?: string
}

type WriteUserToFirestoreType = {
  userId: string
  userData: UserEntry
}

const writeUserToFirestore = async ({
  userId,
  userData,
}: WriteUserToFirestoreType) => {
  try {
    const userRef = doc(db, 'users', userId)
    await setDoc(userRef, userData, { merge: true })
    console.log(`User's ${userData.displayName} data written successfully`)
  } catch (error) {
    console.error('Error creating user:', error)
    // Rethrow so callers can react — e.g. a permission-denied here means the
    // user isn't on the invite allowlist (see firestore.rules).
    throw error
  }
}

type WriteLocationToFirestoreType = {
  userId: string
  locationData: LocationEntry
}

const writeLocationToFirestore = async ({
  userId,
  locationData,
}: WriteLocationToFirestoreType) => {
  try {
    const locationsRef = collection(db, 'users', userId, 'locations')
    const docRef = await addDoc(locationsRef, locationData)
    console.log(`Location data for user ${userId} written successfully`)
    return docRef.id
  } catch (error) {
    console.error('Error writing location data to Firestore:', error)
    throw error
  }
}

type UpdateLocationInFirestoreType = {
  userId: string
  locationId: string
  locationData: {
    city: string
    country: string
    latitude: number
    longitude: number
    travelMode: TravelMode
    // Only sent when the time was changed (Firestore stores a Date as a
    // Timestamp).
    createdAt?: Date
    // Only sent when a place was picked (older entries may not have one).
    placeId?: string
    countryCode?: string
  }
}

const updateLocationInFirestore = async ({
  userId,
  locationId,
  locationData,
}: UpdateLocationInFirestoreType) => {
  try {
    const locationRef = doc(db, 'users', userId, 'locations', locationId)
    await updateDoc(locationRef, locationData)
    console.log(`Location ${locationId} for user ${userId} updated`)
  } catch (error) {
    console.error('Error updating location in Firestore:', error)
    throw error
  }
}

type DeleteLocationFromFirestoreType = {
  userId: string
  locationId: string
}

const deleteLocationFromFirestore = async ({
  userId,
  locationId,
}: DeleteLocationFromFirestoreType) => {
  try {
    const locationRef = doc(db, 'users', userId, 'locations', locationId)
    await deleteDoc(locationRef)
    console.log(`Location ${locationId} for user ${userId} deleted`)
  } catch (error) {
    console.error('Error deleting location from Firestore:', error)
    throw error
  }
}

// One user's profile fields, as the app shows them.
const toUserEntry = (snap: QueryDocumentSnapshot): UserEntry => {
  const data = snap.data()
  return {
    userId: snap.id,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL,
    lastLogin: data.lastLogin,
    customName: data.customName ?? null,
    customPhoto: data.customPhoto ?? null,
    reminderDays: data.reminderDays ?? null,
  }
}

const toLocationEntry = (snap: QueryDocumentSnapshot): LocationEntry => {
  // A just-logged entry's server time isn't known yet: use an estimate.
  const data = snap.data({ serverTimestamps: 'estimate' })
  return {
    id: snap.id,
    userId: data.userId,
    city: data.city,
    country: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
    createdAt: data.createdAt.toDate(),
    travelMode: data.travelMode,
    placeId: data.placeId,
    countryCode: data.countryCode,
  }
}

/**
 * Everyone's profile and locations, kept live: `onChange` gets the full data
 * once everything has loaded, and again whenever anyone logs, edits or
 * deletes an entry or changes their profile (on any device). Returns a
 * function that stops listening.
 */
const subscribeToAllLocations = (
  onChange: (data: LocationData[]) => void,
  onError: (error: Error) => void
) => {
  let order: string[] = [] // user ids, most recently signed in first
  const users = new Map<string, UserEntry>()
  const locations = new Map<string, LocationEntry[]>()
  const stopLocations = new Map<string, () => void>()

  const emit = () => {
    // Wait until every user's locations have arrived at least once.
    if (order.some((id) => !locations.has(id))) return
    onChange(
      order.map((id) => {
        const user = users.get(id)!
        return {
          userId: id,
          // Profile overrides win over the Google name/photo.
          userName: user.customName || user.displayName,
          photoURL: user.customPhoto || user.photoURL,
          customName: user.customName ?? null,
          customPhoto: user.customPhoto ?? null,
          reminderDays: user.reminderDays ?? null,
          lastLogin: user.lastLogin,
          locations: locations.get(id)!,
        }
      })
    )
  }

  const stopUsers = onSnapshot(
    query(collection(db, 'users'), orderBy('lastLogin', 'desc')),
    (snapshot) => {
      order = snapshot.docs.map((d) => d.id)
      for (const d of snapshot.docs) users.set(d.id, toUserEntry(d))
      // Listen to each new user's locations; stop for removed users.
      for (const id of order) {
        if (stopLocations.has(id)) continue
        stopLocations.set(
          id,
          onSnapshot(
            query(
              collection(db, 'users', id, 'locations'),
              orderBy('createdAt', 'desc')
            ),
            (entries) => {
              locations.set(id, entries.docs.map(toLocationEntry))
              emit()
            },
            onError
          )
        )
      }
      for (const [id, stop] of stopLocations) {
        if (order.includes(id)) continue
        stop()
        stopLocations.delete(id)
        locations.delete(id)
        users.delete(id)
      }
      emit()
    },
    onError
  )

  return () => {
    stopUsers()
    stopLocations.forEach((stop) => stop())
  }
}

type UpdateUserProfileType = {
  userId: string
  // null clears the override (falls back to the Google value).
  customName: string | null
  customPhoto: string | null
}

const updateUserProfile = async ({
  userId,
  customName,
  customPhoto,
}: UpdateUserProfileType) => {
  await setDoc(
    doc(db, 'users', userId),
    {
      customName: customName ?? deleteField(),
      customPhoto: customPhoto ?? deleteField(),
    },
    { merge: true }
  )
}

// Convert Firestore Timestamps to { __timestamp: ISO } so a backup is plain
// JSON that a restore script can turn back into Timestamps.
const serializeForBackup = (value: unknown): unknown => {
  if (value && typeof value === 'object') {
    if (typeof (value as { toDate?: unknown }).toDate === 'function') {
      return {
        __timestamp: (value as { toDate: () => Date }).toDate().toISOString(),
      }
    }
    if (Array.isArray(value)) return value.map(serializeForBackup)
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeForBackup(v)])
    )
  }
  return value
}

/** Every user doc and all their locations, as restorable JSON (format v1). */
const exportAllData = async () => {
  const usersSnap = await getDocs(collection(db, 'users'))
  const users = await Promise.all(
    usersSnap.docs.map(async (userDoc) => {
      const locSnap = await getDocs(
        collection(db, 'users', userDoc.id, 'locations')
      )
      return {
        id: userDoc.id,
        data: serializeForBackup(userDoc.data()),
        locations: locSnap.docs.map((d) => ({
          id: d.id,
          data: serializeForBackup(d.data()),
        })),
      }
    })
  )
  return {
    app: 'elektricky-map',
    version: 1,
    exportedAt: new Date().toISOString(),
    users,
  }
}

export {
  analytics,
  app,
  auth,
  checkUserAccess,
  db,
  deleteLocationFromFirestore,
  exportAllData,
  subscribeToAllLocations,
  updateLocationInFirestore,
  updateUserProfile,
  writeLocationToFirestore,
  writeUserToFirestore,
}
