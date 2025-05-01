import { Timestamp } from 'firebase/firestore'

import { LocationEntry } from '@/lib/firebase'

export interface LocationData {
  userId: string
  photoURL: string | null
  lastLogin: Timestamp | null
  locations: LocationEntry[]
}
