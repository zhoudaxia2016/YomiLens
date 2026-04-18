import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-input bg-background/90 px-4 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:shadow-[0_0_0_3px_hsl(var(--brand-soft))]',
        className,
      )}
      {...props}
    />
  )
}
