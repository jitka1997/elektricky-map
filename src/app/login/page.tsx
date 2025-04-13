import Login from '@/components/Login'
import { TITLE } from '@/lib/constants'

const Page = () => {
  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <h1 className="mb-8 text-3xl font-bold">{TITLE}</h1>
      <Login />
    </div>
  )
}

export default Page
