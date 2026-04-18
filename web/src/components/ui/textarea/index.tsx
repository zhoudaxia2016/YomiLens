import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-2xl border border-input bg-background/90 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] focus-visible:border-primary focus-visible:bg-background focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-soft))] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
