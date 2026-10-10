import { Timestamp } from 'firebase/firestore'

import { LocationEntry } from '@/lib/firebase'

export interface LocationData {
  userId: string
  userName: string | null
  photoURL: string | null
  // Raw profile overrides (userName/photoURL above already include them).
  customName?: string | null
  customPhoto?: string | null
  lastLogin: Timestamp | null
  locations: LocationEntry[]
}
