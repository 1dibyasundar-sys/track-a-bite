import React from 'react';
import { cn } from '../../lib/utils';
import { SearchIcon } from './icons';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-stone-400 dark:text-stone-500 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] text-stone-900 dark:text-stone-100 text-sm py-2.5 px-3.5 transition-all duration-150',
              'placeholder:text-stone-400 dark:placeholder:text-stone-500',
              'focus:outline-none focus:border-[#E86A33] dark:focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] dark:focus:ring-[#E86A33]',
              'disabled:bg-stone-50 dark:disabled:bg-stone-900 disabled:text-stone-400 dark:disabled:text-stone-600 disabled:cursor-not-allowed',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-stone-400 dark:text-stone-500 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            'w-full rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] text-stone-900 dark:text-stone-100 text-sm py-2.5 px-3.5 transition-all duration-150',
            'placeholder:text-stone-400 dark:placeholder:text-stone-500',
            'focus:outline-none focus:border-[#E86A33] dark:focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] dark:focus:ring-[#E86A33]',
            'disabled:bg-stone-50 dark:disabled:bg-stone-900 disabled:text-stone-400 dark:disabled:text-stone-600 disabled:cursor-not-allowed',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <div className="absolute left-3.5 text-stone-400 dark:text-stone-500 pointer-events-none flex items-center">
          <SearchIcon size={16} />
        </div>
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            'w-full rounded-xl bg-white dark:bg-[#25211D] border border-stone-300 dark:border-[#38312A] text-stone-900 dark:text-stone-100 text-sm py-2.5 pl-10 pr-9 transition-all duration-150',
            'placeholder:text-stone-400 dark:placeholder:text-stone-500',
            'focus:outline-none focus:border-[#E86A33] dark:focus:border-[#E86A33] focus:ring-1 focus:ring-[#E86A33] dark:focus:ring-[#E86A33]',
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs p-1"
          >
            ✕
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled = false }: SwitchProps) {
  return (
    <label className={cn('flex items-center justify-between gap-3 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed')}>
      {(label || description) && (
        <div className="flex-1">
          {label && <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 block">{label}</span>}
          {description && <span className="text-xs text-stone-500 dark:text-stone-400 block">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A33]',
          checked ? 'bg-[#E86A33]' : 'bg-stone-300 dark:bg-stone-700'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </label>
  );
}
