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

/**
 * Condense a raw API error message into a short human-friendly string.
 * Detects quota/rate-limit, auth, and model-not-found errors.
 */
export function friendlyError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('resource_exhausted') || s.includes('quota exceeded') || s.includes('rate limit') || s.includes('429')) {
    return '⚠ API quota exceeded. Try a different provider or wait before retrying.';
  }
  if (s.includes('model not found')) {
    return '⚠ Selected model not found. Check your API key or choose a different provider.';
  }
  if (s.includes('insufficient balance') || s.includes('402')) {
    return '⚠ Insufficient balance on one or more providers.';
  }
  if (s.includes('invalid api key') || s.includes('401') || s.includes('unauthenticated')) {
    return '⚠ Invalid or missing API key.';
  }
  if (s.includes('all providers failed') || s.includes('all extractions failed')) {
    return '⚠ All providers failed. Check your API keys and quotas.';
  }
  // Truncate long generic messages
  if (raw.length > 120) return raw.slice(0, 117) + '…';
  return raw;
}
