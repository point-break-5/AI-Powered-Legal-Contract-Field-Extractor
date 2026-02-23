/** Merge class names, filtering out falsy values. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Format an ISO date string to a readable local date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Return a colour hex for a confidence float 0–1. */
export function confidenceColor(conf: number | null): string {
  if (conf === null) return 'var(--ash-medium)';
  if (conf >= 0.8) return 'var(--accent-teal)';
  if (conf >= 0.5) return 'var(--accent-amber)';
  return 'var(--accent-coral)';
}
