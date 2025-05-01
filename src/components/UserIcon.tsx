interface UserIconProps {
  photoURL: string | null | undefined
}

const UserIcon = ({ photoURL }: UserIconProps) => {
  if (!photoURL) {
    return (
      <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200 bg-gray-300" />
    )
  }
  return (
    <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200">
      <img
        src={photoURL}
        alt="Profile"
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}

export default UserIcon
