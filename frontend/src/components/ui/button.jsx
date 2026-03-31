import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium tracking-wide transition duration-200 ease-in-out disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-white text-black hover:scale-[1.02] hover:bg-zinc-200',
        secondary:
          'border border-border-subtle bg-bg-elevated text-text-primary hover:scale-[1.02] hover:border-zinc-700 hover:bg-zinc-950',
        ghost:
          'bg-transparent text-text-secondary hover:scale-[1.02] hover:bg-white/5 hover:text-text-primary',
        danger:
          'border border-red-950 bg-red-950/70 text-red-100 hover:scale-[1.02] hover:bg-red-900/80',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      fullWidth: false,
    },
  },
)

export function Button({ className, variant, fullWidth, ...props }) {
  return <button className={cn(buttonVariants({ variant, fullWidth }), className)} {...props} />
}

export { buttonVariants }