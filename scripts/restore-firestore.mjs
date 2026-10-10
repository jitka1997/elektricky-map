// Restore a backup made by the app's "Download backup" or the nightly job.
// Writes every user doc and location back with its original id (overwriting
// docs with the same id; nothing is deleted).
//
// 1. Nightly backups are encrypted: gpg -d elektricky-backup-*.json.gpg > backup.json
// 2. npm install --no-save firebase-admin
// 3. Dry run (checks the file and prints what would be restored; no key needed):
//      node scripts/restore-firestore.mjs backup.json
// 4. Actually write:
//      FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/restore-firestore.mjs backup.json --write
import { readFileSync } from 'node:fs'

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const [file, flag] = process.argv.slice(2)
if (!file)
  throw new Error('Usage: restore-firestore.mjs <backup.json> [--write]')
const backup = JSON.parse(readFileSync(file, 'utf8'))
if (backup.app !== 'elektricky-map' || backup.version !== 1) {
  throw new Error('Not an Električky backup (format v1)')
}

// { __timestamp: ISO } -> Firestore Timestamp.
const revive = (value) => {
  if (value && typeof value === 'object') {
    if (typeof value.__timestamp === 'string') {
      return Timestamp.fromDate(new Date(value.__timestamp))
    }
    if (Array.isArray(value)) return value.map(revive)
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, revive(v)])
    )
  }
  return value
}

const write = flag === '--write'
// Credentials are only needed to write; a dry run just checks the file.
let db
let writer
if (write) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  }
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  })
  db = getFirestore()
  writer = db.bulkWriter()
}

let locationCount = 0
for (const user of backup.users) {
  const userRef = write ? db.collection('users').doc(user.id) : null
  if (write) writer.set(userRef, revive(user.data))
  for (const location of user.locations) {
    if (write) {
      writer.set(
        userRef.collection('locations').doc(location.id),
        revive(location.data)
      )
    }
    locationCount++
  }
}
if (write) await writer.close()

console.log(
  `${write ? 'Restored' : 'Would restore'} ${backup.users.length} users, ` +
    `${locationCount} locations from backup made ${backup.exportedAt}` +
    (write ? '' : '\nRun again with --write to apply.')
)
