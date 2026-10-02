import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'warm' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A33] dark:focus-visible:ring-[#E86A33] focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

    const variants = {
      primary:
        'bg-[#E86A33] hover:bg-[#d65f2c] text-white shadow-sm border border-[#E86A33]/20 hover:shadow-md transition-all',
      secondary:
        'bg-[#F3EDE4] dark:bg-[#25211D] text-[#171717] dark:text-[#F7F3ED] hover:bg-[#eae2d6] dark:hover:bg-[#2e2924] border border-[#E8DED2] dark:border-[#38312A]',
      outline:
        'bg-white dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 border border-[#E8DED2] dark:border-[#38312A] hover:bg-[#FAF7F2] dark:hover:bg-[#25211D] hover:border-[#E86A33]/40 dark:hover:border-[#E86A33]/40 shadow-2xs',
      ghost:
        'text-stone-700 dark:text-stone-300 hover:bg-[#F3EDE4] dark:hover:bg-[#25211D] hover:text-[#171717] dark:hover:text-[#F7F3ED]',
      warm:
        'bg-[#F4A340] text-stone-950 hover:bg-[#e89732] shadow-sm border border-[#F4A340]/20 font-bold',
      danger:
        'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60',
      subtle:
        'bg-[#F3EDE4] dark:bg-[#25211D] text-stone-800 dark:text-stone-200 hover:bg-[#eae2d6] dark:hover:bg-[#2e2924] border border-[#E8DED2] dark:border-[#38312A]',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[36px]',
      md: 'text-sm px-4 py-2.5 gap-2 min-h-[44px]',
      lg: 'text-base px-6 py-3.5 gap-2.5 min-h-[50px] font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, variant = 'ghost', size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8 p-1.5 text-xs rounded-lg',
      md: 'w-10 h-10 p-2 text-sm rounded-xl',
      lg: 'w-12 h-12 p-3 text-base rounded-2xl',
    };

    const variantClasses = {
      primary: 'bg-[#E86A33] hover:bg-[#d65f2c] text-white shadow-2xs',
      secondary: 'bg-[#F3EDE4] dark:bg-[#25211D] text-[#171717] dark:text-[#F7F3ED]',
      outline: 'bg-white dark:bg-[#1D1A17] border border-[#E8DED2] dark:border-[#38312A] text-stone-700 dark:text-stone-300 hover:bg-[#FAF7F2] dark:hover:bg-[#25211D]',
      ghost: 'text-stone-600 dark:text-stone-300 hover:bg-[#F3EDE4] dark:hover:bg-[#25211D]',
      subtle: 'bg-[#F3EDE4] dark:bg-[#25211D] text-stone-700 dark:text-stone-300 hover:bg-[#eae2d6] dark:hover:bg-[#2e2924]',
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A33] cursor-pointer',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
