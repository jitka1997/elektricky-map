// Restore a backup made by the app's "Download backup" or the nightly job, and
// undo that restore exactly.
//
//   --write   first saves the current state of every user in the backup to an
//             undo file (next to the backup), then writes every user doc and
//             location back with its original id. Docs with the same id are
//             overwritten; nothing else is deleted.
//   --undo    takes that undo file and puts every touched doc back the way it
//             was before the restore: overwritten docs get their old data,
//             added docs are deleted, users not in the backup are never touched.
//             If anything was changed after the restore (e.g. a friend logged a
//             new location), it refuses and changes nothing.
//
// Writing or undoing requires --project=<id> matching the key's project, so
// you can't hit the wrong database by accident.
//
// 1. Nightly backups are encrypted: gpg -d elektricky-backup-*.json.gpg > backup.json
// 2. Run from a separate folder with its own firebase-admin (installing it into
//    the app's node_modules breaks its dependency tree):
//      mkdir -p ~/elektricky-tools && cd ~/elektricky-tools
//      npm init -y && npm install firebase-admin && cp <repo>/scripts/*.mjs .
// 3. export FIREBASE_SERVICE_ACCOUNT="$(cat key.json)"
// 4. Dry run (shows the target project and how many users would be overwritten):
//      node restore-firestore.mjs backup.json
// 5. Restore (prints where it saved the undo file — keep it):
//      node restore-firestore.mjs backup.json --write --project=<id>
// 6. Undo:
//      node restore-firestore.mjs undo-<id>-<time>.json --undo --project=<id>
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const write = args.includes('--write')
const undo = args.includes('--undo')
const confirmedProject = args
  .find((a) => a.startsWith('--project='))
  ?.slice('--project='.length)

if (!file) {
  throw new Error(
    'Usage: restore-firestore.mjs <backup.json> [--write --project=<id>]\n' +
      '       restore-firestore.mjs <undo-file.json> --undo --project=<id>'
  )
}
if (write && undo) throw new Error('Use either --write or --undo, not both')

const input = JSON.parse(readFileSync(file, 'utf8'))
if (input.app !== 'elektricky-map' || input.version !== 1) {
  throw new Error('Not an Električky backup or undo file (format v1)')
}
if (undo && input.kind !== 'undo') {
  throw new Error(
    '--undo needs the undo file that --write saved, not the backup itself'
  )
}
if (!undo && input.kind === 'undo') {
  throw new Error('This is an undo file — run it with --undo')
}

const key = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null
if (key) console.log(`Target project: ${key.project_id}`)

if ((write || undo) && !key) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
}
if (undo && input.project !== key.project_id) {
  throw new Error(
    `This undo file is for project ${input.project}, but the key is for ${key.project_id}`
  )
}
if ((write || undo) && confirmedProject !== key.project_id) {
  throw new Error(
    `Refusing to ${write ? 'write' : 'undo'}: add --project=${key.project_id} ` +
      'to confirm this is the project you mean'
  )
}

// Timestamps -> { __timestamp: ISO }, same as the backup format.
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

// JSON with sorted keys, so equal data compares equal regardless of key order.
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
const same = (a, b) => canonical(a ?? null) === canonical(b ?? null)

// A user as { data, locations } -> Map of doc path -> data (missing = absent).
const toDocs = (userId, { data, locations }) => {
  const docs = new Map()
  if (data !== null) docs.set(`users/${userId}`, data)
  for (const l of locations) {
    docs.set(`users/${userId}/locations/${l.id}`, l.data)
  }
  return docs
}

const countLocations = (users) =>
  users.reduce((n, u) => n + u.locations.length, 0)

if (!key) {
  console.log(
    `Backup has ${input.users.length} users, ${countLocations(input.users)} ` +
      `locations, made ${input.exportedAt}`
  )
  console.log('Set FIREBASE_SERVICE_ACCOUNT to compare it with a project.')
  process.exit(0)
}

initializeApp({ credential: cert(key) })
const db = getFirestore()

// A user's current doc and locations, in backup format (data null if no doc).
const readUser = async (userId) => {
  const ref = db.collection('users').doc(userId)
  const [doc, locations] = await Promise.all([
    ref.get(),
    ref.collection('locations').get(),
  ])
  return {
    data: doc.exists ? serialize(doc.data()) : null,
    locations: locations.docs.map((d) => ({
      id: d.id,
      data: serialize(d.data()),
    })),
  }
}

// Applies [{ path, data }] — data null deletes. Returns the number that failed.
const applyWrites = async (ops) => {
  const writer = db.bulkWriter()
  let failed = 0
  for (const { path, data } of ops) {
    const ref = db.doc(path)
    const result =
      data === null ? writer.delete(ref) : writer.set(ref, revive(data))
    result.catch(() => failed++)
  }
  await writer.close()
  return failed
}

if (undo) {
  // Every doc the restore could have touched must now hold either what the
  // restore wrote or what was there before; anything else is a later change
  // that undoing would destroy.
  const conflicts = []
  const ops = []
  for (const user of input.users) {
    const now = toDocs(user.id, await readUser(user.id))
    const before = toDocs(user.id, user.before)
    const restored = toDocs(user.id, user.restored)
    const paths = new Set([...now.keys(), ...before.keys(), ...restored.keys()])
    for (const path of paths) {
      const current = now.get(path)
      const old = before.get(path)
      if (same(current, old)) continue
      if (!same(current, restored.get(path))) conflicts.push(path)
      else ops.push({ path, data: old ?? null })
    }
  }

  if (conflicts.length > 0) {
    console.error(
      `Refusing to undo: ${conflicts.length} doc(s) changed after the restore, ` +
        'and undoing would lose those changes. Nothing was changed.'
    )
    for (const path of conflicts) console.error(`  ${path}`)
    process.exit(1)
  }
  if (ops.length === 0) {
    console.log('Nothing to undo — everything is already as it was before.')
    process.exit(0)
  }

  const failed = await applyWrites(ops)
  if (failed > 0) {
    console.error(
      `${failed} of ${ops.length} docs failed. Run the same undo again — ` +
        'it only touches what is still different.'
    )
    process.exit(1)
  }
  console.log(`Undone: put back ${ops.length} docs as they were before.`)
} else {
  const before = await Promise.all(input.users.map((u) => readUser(u.id)))
  const existing = before.filter(
    (b) => b.data !== null || b.locations.length > 0
  ).length
  console.log(
    `Backup has ${input.users.length} users, ${countLocations(input.users)} ` +
      `locations, made ${input.exportedAt}`
  )
  console.log(
    `Already in ${key.project_id}: ${existing} of those users ` +
      `(their docs with the same id get overwritten); ` +
      `new: ${input.users.length - existing}`
  )

  if (!write) {
    console.log(
      'Dry run — nothing written. Run again with ' +
        `--write --project=${key.project_id} to restore.`
    )
    process.exit(0)
  }

  // Save the current state before writing anything; if this fails, stop.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const undoFile = join(
    dirname(resolve(file)),
    `undo-${key.project_id}-${stamp}.json`
  )
  writeFileSync(
    undoFile,
    JSON.stringify(
      {
        app: 'elektricky-map',
        kind: 'undo',
        version: 1,
        project: key.project_id,
        createdAt: new Date().toISOString(),
        backupExportedAt: input.exportedAt,
        users: input.users.map((u, i) => ({
          id: u.id,
          before: before[i],
          restored: { data: u.data, locations: u.locations },
        })),
      },
      null,
      2
    ),
    { flag: 'wx' }
  )
  console.log(`Saved the current state to ${undoFile}`)

  const ops = input.users.flatMap((u) => [
    { path: `users/${u.id}`, data: u.data },
    ...u.locations.map((l) => ({
      path: `users/${u.id}/locations/${l.id}`,
      data: l.data,
    })),
  ])
  const failed = await applyWrites(ops)
  if (failed > 0) {
    console.error(
      `${failed} of ${ops.length} docs failed to write. ` +
        'Run --undo with the undo file to go back, or --write again to retry.'
    )
    process.exit(1)
  }
  console.log(`Restored ${input.users.length} users. To undo:`)
  console.log(
    `  node restore-firestore.mjs ${undoFile} --undo --project=${key.project_id}`
  )
}
