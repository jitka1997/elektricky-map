import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

const Container = ({ children, className }: PropsWithChildren<Props>) => {
  return (
    <div
      className={twMerge(
        'mx-auto w-full max-w-screen-2xl px-4 print:px-0',
        className
      )}
    >
      {children}
    </div>
  )
}

export default Container
