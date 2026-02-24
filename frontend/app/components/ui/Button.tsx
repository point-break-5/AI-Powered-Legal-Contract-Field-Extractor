'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 shadow-xs',
  secondary:
    'bg-[var(--ash-light)] text-[var(--ash-charcoal)] border border-[var(--ash-gray)] hover:bg-[var(--ash-gray)] shadow-xs',
  destructive:
    'bg-[var(--accent-coral)] text-white hover:bg-[var(--accent-coral)]/90 shadow-xs',
  ghost:
    'text-[var(--ash-charcoal)] hover:bg-[var(--ash-light)]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

const iconSizes: Record<Size, number> = { sm: 12, md: 15, lg: 17 };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-all duration-200 select-none',
        variantClasses[variant],
        sizeClasses[size],
        loading && 'cursor-wait animate-btn-loading',
        !loading && disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {loading && (
        <Loader2 size={iconSizes[size]} className="animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
}
