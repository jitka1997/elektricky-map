import { getAnalytics } from 'firebase/analytics'
import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore'

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
  // Firestore document id — present on entries read back from Firestore,
  // absent when constructing a new entry to write.
  id?: string
  userId: string
  city: string
  country: string
  latitude: number
  longitude: number
  createdAt: Date | Timestamp
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

async function getUserLocations(userId: string) {
  try {
    // Create a reference to the locations collection
    const locationsRef = collection(db, 'users', userId, 'locations')

    const q = query(locationsRef, orderBy('createdAt', 'desc'))

    const querySnapshot = await getDocs(q)

    // Map the results to your LocationEntry type
    const locations: LocationEntry[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      locations.push({
        id: doc.id,
        userId: data.userId,
        city: data.city,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: data.createdAt.toDate(),
      })
    })

    return locations
  } catch (error) {
    console.error('Error fetching user locations:', error)
    throw error
  }
}

async function getAllUsers() {
  try {
    // Create a reference to the users collection
    const usersRef = collection(db, 'users')

    // Create a query against the collection
    const q = query(usersRef, orderBy('lastLogin', 'desc'))

    const querySnapshot = await getDocs(q)

    // Map the results to your UserEntry type
    const users: UserEntry[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      users.push({
        userId: data.userId,
        displayName: data.displayName,
        email: data.email,
        photoURL: data.photoURL,
        lastLogin: data.lastLogin,
      })
    })

    return users
  } catch (error) {
    console.error('Error fetching all users:', error)
    throw error
  }
}

async function getAllLocations() {
  const users = await getAllUsers()
  const allLocations = users.map(async (user) => {
    const locations = await getUserLocations(user.userId)
    return {
      userId: user.userId,
      userName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: user.lastLogin,
      locations,
    }
  })
  return allLocations
}

export {
  analytics,
  app,
  auth,
  db,
  deleteLocationFromFirestore,
  getAllLocations,
  writeLocationToFirestore,
  writeUserToFirestore,
}
