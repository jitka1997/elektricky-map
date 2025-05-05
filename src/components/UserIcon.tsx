interface UserIconProps {
  photoURL: string | null | undefined
}

const UserIcon = ({ photoURL }: UserIconProps) => {
  if (!photoURL) {
    return (
      <div className="border-base-300 bg-base-300 h-8 w-8 overflow-hidden rounded-full border" />
    )
  }
  return (
    <div className="border-base-300 h-8 w-8 overflow-hidden rounded-full border">
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
