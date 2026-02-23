'use client';

import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 14, md: 20, lg: 28 };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <Loader2
      size={sizes[size]}
      className={`animate-spin text-[var(--accent-blue)] ${className}`}
    />
  );
}
