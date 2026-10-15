import { FieldValue } from 'firebase-admin/firestore'

import {
  adminDb,
  authenticate,
  unauthorized,
  withErrors,
} from '@/lib/server/admin'

// "Yes, still here" on the check-in pop-up: restarts the reminder clock
// without logging the same city again.
async function checkIn(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized()

  await adminDb()
    .doc(`users/${userId}`)
    .update({ lastCheckIn: FieldValue.serverTimestamp() })
  return Response.json({ ok: true })
}

export const POST = withErrors(checkIn)
