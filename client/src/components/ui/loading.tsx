import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  color?: 'primary' | 'white' | 'gray'
}

export function LoadingSpinner({ 
  size = 'md', 
  className,
  color = 'primary' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  }

  const colorClasses = {
    primary: 'border-primary-600 border-t-transparent',
    white: 'border-white border-t-transparent',
    gray: 'border-gray-300 border-t-transparent'
  }

  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

interface LoadingDotsProps {
  className?: string
  color?: 'primary' | 'gray'
}

export function LoadingDots({ className, color = 'primary' }: LoadingDotsProps) {
  const colorClasses = {
    primary: 'bg-primary-600',
    gray: 'bg-gray-400'
  }

  return (
    <div className={clsx('flex items-center space-x-1', className)}>
      <div
        className={clsx(
          'w-2 h-2 rounded-full animate-bounce',
          colorClasses[color]
        )}
        style={{ animationDelay: '0ms' }}
      />
      <div
        className={clsx(
          'w-2 h-2 rounded-full animate-bounce',
          colorClasses[color]
        )}
        style={{ animationDelay: '150ms' }}
      />
      <div
        className={clsx(
          'w-2 h-2 rounded-full animate-bounce',
          colorClasses[color]
        )}
        style={{ animationDelay: '300ms' }}
      />
    </div>
  )
}

interface LoadingSkeletonProps {
  className?: string
  lines?: number
  height?: string
}

export function LoadingSkeleton({ 
  className, 
  lines = 1, 
  height = 'h-4' 
}: LoadingSkeletonProps) {
  return (
    <div className={clsx('animate-pulse space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={clsx(
            'bg-gray-200 rounded',
            height,
            index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

interface LoadingPageProps {
  title?: string
  description?: string
}

export function LoadingPage({ 
  title = 'Loading...', 
  description 
}: LoadingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-gray-600">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

interface LoadingCardProps {
  className?: string
}

export function LoadingCard({ className }: LoadingCardProps) {
  return (
    <div className={clsx('card animate-pulse', className)}>
      <div className="space-y-3">
        <LoadingSkeleton height="h-5" />
        <LoadingSkeleton lines={2} height="h-4" />
        <div className="flex space-x-2">
          <div className="bg-gray-200 rounded px-2 py-1 w-16 h-6" />
          <div className="bg-gray-200 rounded px-2 py-1 w-20 h-6" />
        </div>
      </div>
    </div>
  )
}

interface LoadingButtonProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
  isLoading?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export function LoadingButton({
  size = 'md',
  variant = 'primary',
  children,
  isLoading = false,
  disabled = false,
  className,
  onClick,
  type = 'button'
}: LoadingButtonProps) {
  const baseClasses = 'btn relative'
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary'
  }
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  }

  return (
    <button
      type={type}
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      onClick={onClick}
      aria-disabled={disabled || isLoading}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner 
            size="sm" 
            color={variant === 'primary' ? 'white' : 'primary'} 
          />
        </div>
      )}
      <span className={clsx(isLoading && 'opacity-0')}>
        {children}
      </span>
    </button>
  )
}
