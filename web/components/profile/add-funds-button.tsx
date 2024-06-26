import { AddFundsModal } from '../add-funds-modal'
import { useUser } from 'web/hooks/use-user'
import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/solid'
import clsx from 'clsx'
import { Button } from '../buttons/button'

export function AddFundsButton(props: { userId?: string; className?: string }) {
  const { userId, className } = props
  const [open, setOpen] = useState(false)
  const user = useUser()
  if (!userId || user?.id !== userId) return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'border-primary-500 text-primary-500 hover:bg-primary-500 flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-colors hover:text-white sm:hidden',
          className
        )}
      >
        <PlusIcon className="h-5 w-5" />
      </button>
      <Button
        onClick={() => setOpen(true)}
        size="2xs"
        color="indigo-outline"
        className="hidden sm:inline-flex"
      >
        <PlusIcon className="mr-1 h-3 w-3" />
        Add mana
      </Button>
      <AddFundsModal open={open} setOpen={setOpen} />
    </>
  )
}
