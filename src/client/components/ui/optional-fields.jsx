import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OptionalFields({ children, className = '' }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('space-y-3', className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn('transition-transform', open ? 'rotate-180' : '')}
        />
        {open ? 'Hide optional fields' : 'Show optional fields'}
      </Button>
      {open ? <div className="space-y-3">{children}</div> : null}
    </div>
  )
}
