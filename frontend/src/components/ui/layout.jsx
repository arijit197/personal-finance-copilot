import { cn } from '../../lib/utils'

export function Container({ className, children, ...props }) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-5 lg:px-8', className)} {...props}>
      {children}
    </div>
  )
}

export function Section({ className, children, ...props }) {
  return (
    <section className={cn('space-y-6', className)} {...props}>
      {children}
    </section>
  )
}