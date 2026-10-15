import { authenticate, unauthorized, withErrors } from '@/lib/server/admin'
import { sendToUsers } from '@/lib/server/push'

// "Send me a test" on the Profile page: a notification to all your devices.
async function sendTest(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized()

  const sent = await sendToUsers(
    [userId],
    {
      title: '🚊 Notifications are on',
      body: "This is how you'll hear when a friend arrives in your city.",
      url: '/profile',
      tag: 'test',
    },
    60 * 60
  )
  return Response.json({ sent })
}

export const POST = withErrors(sendTest)
