'use client';

import { useEffect } from 'react';
import { AlertCircle, X, AlertTriangle, CheckCircle } from 'lucide-react';

export type ToastType = 'error' | 'warning' | 'success';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const icons = {
  error:   <AlertCircle size={14} className="shrink-0 text-[var(--accent-coral)]" />,
  warning: <AlertTriangle size={14} className="shrink-0 text-[var(--accent-amber)]" />,
  success: <CheckCircle size={14} className="shrink-0 text-[var(--accent-teal)]" />,
};

const borders = {
  error:   'border-[var(--accent-coral)]/40 bg-red-50',
  warning: 'border-[var(--accent-amber)]/40 bg-amber-50',
  success: 'border-[var(--accent-teal)]/40 bg-teal-50',
};

interface ToastProps {
  toasts: ToastItem[];
  remove: (id: number) => void;
}

export function ToastContainer({ toasts, remove }: ToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} remove={remove} />
      ))}
    </div>
  );
}

function ToastCard({ toast, remove }: { toast: ToastItem; remove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, remove]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-[var(--radius-lg)] border shadow-lg text-xs text-[var(--ash-black)] animate-fade-in ${borders[toast.type]}`}
    >
      {icons[toast.type]}
      <p className="flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => remove(toast.id)}
        className="p-0.5 rounded text-[var(--ash-dark)] hover:text-[var(--ash-charcoal)] transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}
