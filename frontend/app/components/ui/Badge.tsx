'use client';

interface BadgeProps {
  status: string;
  className?: string;
}

type BadgeConfig = { label: string; className: string };

const STATUS_MAP: Record<string, BadgeConfig> = {
  // ProjectStatus
  PENDING:        { label: 'Pending',    className: 'bg-[var(--ash-light)] text-[var(--ash-charcoal)] border border-[var(--ash-gray)]' },
  PROCESSING:     { label: 'Processing', className: 'bg-[var(--accent-amber)]/20 text-[var(--ash-deep)] border border-[var(--accent-amber)]/40' },
  READY:          { label: 'Ready',      className: 'bg-[var(--accent-teal)]/15 text-[var(--ash-deep)] border border-[var(--accent-teal)]/40' },

  // ParseStatus
  QUEUED:         { label: 'Queued',     className: 'bg-[var(--ash-light)] text-[var(--ash-charcoal)] border border-[var(--ash-gray)]' },
  PARSING:        { label: 'Parsing…',   className: 'bg-[var(--accent-amber)]/20 text-[var(--ash-deep)] border border-[var(--accent-amber)]/40' },
  DONE:           { label: 'Done',       className: 'bg-[var(--accent-teal)]/15 text-[var(--ash-deep)] border border-[var(--accent-teal)]/40' },
  ERROR:          { label: 'Error',      className: 'bg-[var(--accent-coral)]/15 text-[var(--ash-deep)] border border-[var(--accent-coral)]/40' },

  // ReviewStatus
  CONFIRMED:      { label: 'Confirmed',  className: 'bg-[var(--accent-teal)]/15 text-[var(--ash-deep)] border border-[var(--accent-teal)]/40' },
  REJECTED:       { label: 'Rejected',   className: 'bg-[var(--accent-coral)]/15 text-[var(--ash-deep)] border border-[var(--accent-coral)]/40' },
  MANUAL_UPDATED: { label: 'Edited',     className: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30' },
  MISSING_DATA:   { label: 'Missing',    className: 'bg-[var(--accent-coral)]/15 text-[var(--ash-deep)] border border-[var(--accent-coral)]/40' },
  STALE:          { label: 'Stale',      className: 'bg-[var(--accent-amber)]/20 text-[var(--ash-deep)] border border-[var(--accent-amber)]/40' },
};

export function Badge({ status, className = '' }: BadgeProps) {
  const cfg = STATUS_MAP[status] ?? { label: status, className: 'bg-[var(--ash-light)] text-[var(--ash-charcoal)] border border-[var(--ash-gray)]' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.className} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
