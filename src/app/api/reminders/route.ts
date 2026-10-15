import { REMINDER_OPTIONS } from '@/lib/reminders'
import {
  adminDb,
  authenticate,
  unauthorized,
  withErrors,
} from '@/lib/server/admin'

// The "Remind me to check in" setting on Profile.
async function saveReminderSetting(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized()

  const { reminderDays } = (await request.json()) as { reminderDays?: unknown }
  if (!REMINDER_OPTIONS.some(([days]) => days === reminderDays))
    return Response.json(
      { error: 'Unknown reminder setting.' },
      { status: 400 }
    )

  await adminDb().doc(`users/${userId}`).update({ reminderDays })
  return Response.json({ ok: true })
}

export const POST = withErrors(saveReminderSetting)
