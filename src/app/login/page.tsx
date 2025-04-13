import Login from '@/components/Login'
import { TITLE } from '@/lib/constants'

const Page = () => {
  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-8">{TITLE}</h1>
      <Login />
    </div>
  )
}

export default Page
