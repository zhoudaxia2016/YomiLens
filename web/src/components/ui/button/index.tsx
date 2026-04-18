import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-[background-color,color,border-color,opacity,transform] duration-300 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--panel-shadow)/0.12)] hover:bg-transparent hover:text-primary active:translate-y-px',
        secondary:
          'border border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--panel-shadow)/0.12)] hover:bg-transparent hover:text-primary active:translate-y-px',
        outline:
          'border border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--panel-shadow)/0.12)] hover:bg-transparent hover:text-primary active:translate-y-px',
        ghost:
          'border border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--panel-shadow)/0.12)] hover:bg-transparent hover:text-primary active:translate-y-px',
        underline:
          'border border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--panel-shadow)/0.12)] hover:bg-transparent hover:text-primary active:translate-y-px',
        destructive:
          'border border-destructive bg-destructive text-destructive-foreground shadow-[0_8px_22px_hsl(var(--panel-shadow)/0.1)] hover:bg-transparent hover:text-destructive active:translate-y-px',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ asChild = false, className, variant, ...props }: Props) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />
}
