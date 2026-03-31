import { cn } from '../../lib/utils'

const inputBaseClass =
  'w-full rounded-xl border border-border-subtle bg-bg-secondary px-4 py-3 text-sm font-medium text-text-primary outline-none transition duration-200 ease-in-out placeholder:text-text-muted focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700'

export function Input({ className, ...props }) {
  return <input className={cn(inputBaseClass, className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(inputBaseClass, 'min-h-[140px] resize-y', className)} {...props} />
}

export function Select({ className, ...props }) {
  return <select className={cn(inputBaseClass, className)} {...props} />
}