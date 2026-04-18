import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-2xl border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'border-panel-border bg-panel-muted/70 text-foreground',
      success: 'border-primary/15 bg-brand-soft text-foreground',
      destructive: 'border-destructive/20 bg-destructive/10 text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ variant }), className)} role="alert" {...props} />
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm leading-6 [&_p]:m-0', className)} {...props} />
}
