// Firestore backup — run nightly by .github/workflows/backup.yml.
// Reads every user and their locations with the Admin SDK (bypasses security
// rules) and writes a JSON snapshot in the same format as the in-app
// "Download backup" (restore with scripts/restore-firestore.mjs).
//
// Usage: FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node backup-firestore.mjs out.json
// Needs `firebase-admin` resolvable from this file's directory — run it from a
// separate folder (see restore-firestore.mjs), not from inside the app.
import { writeFileSync } from 'node:fs'

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
}
initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
})
const db = getFirestore()

// Timestamps -> { __timestamp: ISO } so the file is plain, restorable JSON.
const serialize = (value) => {
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return { __timestamp: value.toDate().toISOString() }
    }
    if (Array.isArray(value)) return value.map(serialize)
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serialize(v)])
    )
  }
  return value
}

const usersSnap = await db.collection('users').get()
const users = await Promise.all(
  usersSnap.docs.map(async (userDoc) => {
    const locations = await userDoc.ref.collection('locations').get()
    return {
      id: userDoc.id,
      data: serialize(userDoc.data()),
      locations: locations.docs.map((d) => ({
        id: d.id,
        data: serialize(d.data()),
      })),
    }
  })
)

const out = process.argv[2] ?? 'backup.json'
writeFileSync(
  out,
  JSON.stringify(
    {
      app: 'elektricky-map',
      version: 1,
      exportedAt: new Date().toISOString(),
      users,
    },
    null,
    2
  )
)

// Counts only — workflow logs of a public repo are public, never print data.
const locationCount = users.reduce((n, u) => n + u.locations.length, 0)
console.log(`Backed up ${users.length} users, ${locationCount} locations`)
