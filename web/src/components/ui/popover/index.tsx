import type { ComponentProps } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export const Popover = PopoverPrimitive.Root

export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-lg border border-panel-border bg-popover text-popover-foreground shadow-panel outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export const PopoverAnchor = PopoverPrimitive.Anchor
