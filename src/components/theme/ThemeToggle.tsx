'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, Theme } from './ThemeProvider';
import { SunIcon, MoonIcon, MonitorIcon, CheckIcon } from '../ui/icons';
import { cn } from '../../lib/utils';

export interface ThemeToggleProps {
  variant?: 'dropdown' | 'cycle' | 'segmented';
  className?: string;
}

export function ThemeToggle({ variant = 'dropdown', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: <SunIcon size={16} className="text-amber-500" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <MoonIcon size={16} className="text-emerald-400" />,
    },
    {
      value: 'system',
      label: 'System',
      icon: <MonitorIcon size={16} className="text-stone-400" />,
    },
  ];

  // Segmented control (ideal for mobile drawer / settings)
  if (variant === 'segmented') {
    return (
      <div
        role="radiogroup"
        aria-label="Color theme selector"
        className={cn(
          'grid grid-cols-3 p-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold',
          className
        )}
      >
        {options.map((opt) => {
          const isSelected = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-semibold',
                isSelected
                  ? 'bg-white dark:bg-[#19271e] text-emerald-950 dark:text-emerald-200 shadow-2xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              )}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Pure click-to-cycle button
  if (variant === 'cycle') {
    const currentLabel =
      theme === 'system'
        ? `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
        : theme === 'dark'
        ? 'Dark'
        : 'Light';

    return (
      <button
        type="button"
        onClick={cycleTheme}
        className={cn(
          'p-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer flex items-center gap-1.5',
          className
        )}
        aria-label={`Current theme is ${currentLabel}. Click to switch theme.`}
        title={`Theme: ${currentLabel} (Click to switch)`}
      >
        {resolvedTheme === 'dark' ? (
          <MoonIcon size={18} className="text-emerald-400" />
        ) : (
          <SunIcon size={18} className="text-amber-500" />
        )}
      </button>
    );
  }

  // Default: Accessible Dropdown Popover
  const currentIcon =
    theme === 'system' ? (
      <MonitorIcon size={17} className="text-stone-600 dark:text-stone-300" />
    ) : theme === 'dark' ? (
      <MoonIcon size={17} className="text-emerald-400" />
    ) : (
      <SunIcon size={17} className="text-amber-500" />
    );

  const themeLabel =
    theme === 'system'
      ? `System (${resolvedTheme})`
      : theme === 'dark'
      ? 'Dark'
      : 'Light';

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'p-2 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
          isOpen
            ? 'bg-stone-200 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs'
            : 'bg-stone-100/90 dark:bg-stone-900/90 hover:bg-stone-200/80 dark:hover:bg-stone-800 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
        )}
        aria-label="Change color theme"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`Theme: ${themeLabel}. Click to choose.`}
      >
        <span className="shrink-0">{currentIcon}</span>
        <span className="hidden xl:inline text-xs font-semibold text-stone-700 dark:text-stone-300">
          {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Theme options"
          className="absolute right-0 mt-1.5 w-36 rounded-2xl bg-white dark:bg-[#1D1A17] border border-stone-200 dark:border-[#38312A] shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {options.map((opt) => {
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-xl transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-[#FEF7EE] dark:bg-[#2A1C14] text-[#E86A33] font-bold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#25211D]'
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && (
                  <CheckIcon size={14} className="text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
