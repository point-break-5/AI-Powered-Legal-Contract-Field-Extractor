'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
} from 'lucide-react';
import { api, type ProjectLog, type LogLevel } from '@/lib/api';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<string, string> = {
  DOCUMENT_UPLOADED: 'Document Uploaded',
  DOCUMENT_UPLOAD_FAILED: 'Upload Failed',
  DOCUMENT_REMOVED: 'Document Removed',
  EXTRACTION_COMPLETED: 'Extraction Completed',
  EXTRACTION_FAILED: 'Extraction Failed',
  EXTRACTION_CLEARED: 'Extraction Cleared',
  FIELD_EXTRACTED: 'Field Re-extracted',
  FIELD_EXTRACTION_FAILED: 'Field Extraction Failed',
};

function eventLabel(type: string) {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ');
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Level badge
// ---------------------------------------------------------------------------

function LevelBadge({ level }: { level: LogLevel }) {
  if (level === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
        <XCircle size={11} />
        ERROR
      </span>
    );
  }
  if (level === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
        <AlertTriangle size={11} />
        WARN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
      <CheckCircle2 size={11} />
      INFO
    </span>
  );
}

// ---------------------------------------------------------------------------
// Event chip
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, string> = {
  DOCUMENT_UPLOADED: 'bg-teal-50 text-teal-700 border-teal-200',
  DOCUMENT_UPLOAD_FAILED: 'bg-red-50 text-red-700 border-red-200',
  DOCUMENT_REMOVED: 'bg-slate-100 text-slate-600 border-slate-200',
  EXTRACTION_COMPLETED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  EXTRACTION_FAILED: 'bg-red-50 text-red-700 border-red-200',
  EXTRACTION_CLEARED: 'bg-amber-50 text-amber-700 border-amber-200',
  FIELD_EXTRACTED: 'bg-violet-50 text-violet-700 border-violet-200',
  FIELD_EXTRACTION_FAILED: 'bg-red-50 text-red-700 border-red-200',
};

function EventChip({ type }: { type: string }) {
  const cls = EVENT_COLORS[type] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cls} whitespace-nowrap`}>
      {eventLabel(type)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Level filter pill
// ---------------------------------------------------------------------------

const LEVELS: { value: LogLevel | 'ALL'; label: string }[] = [
  { value: 'ALL',     label: 'All'     },
  { value: 'INFO',    label: 'Info'    },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR',   label: 'Error'   },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LogsPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params?.id ?? 0);

  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.logs.list(projectId, filter === 'ALL' ? undefined : filter);
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  // Initial load + re-load when filter changes
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadLogs();
    }, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadLogs]);

  async function handleClear() {
    if (!confirm('Delete all activity logs for this project?')) return;
    setClearing(true);
    try {
      await api.logs.clear(projectId);
      setLogs([]);
    } finally {
      setClearing(false);
    }
  }

  const shown = logs; // already filtered by the backend

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 bg-white border-b border-[var(--ash-gray)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-[var(--accent-blue)]" />
          <h1 className="text-base font-semibold text-[var(--ash-black)]">Activity Logs</h1>
          <span className="ml-1 text-xs text-[var(--ash-medium)] bg-[var(--ash-light)] px-2 py-0.5 rounded-full">
            {shown.length} {shown.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadLogs}
            loading={loading}
            title="Refresh logs"
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleClear}
            loading={clearing}
            disabled={logs.length === 0}
          >
            <Trash2 size={13} />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 px-6 py-3 bg-white border-b border-[var(--ash-gray)] flex items-center gap-2">
        <Filter size={13} className="text-[var(--ash-medium)]" />
        <span className="text-xs text-[var(--ash-medium)] mr-1">Level:</span>
        {LEVELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === value
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--ash-light)] text-[var(--ash-charcoal)] hover:bg-[var(--ash-gray)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-6 p-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)] text-sm text-red-600">
            {error}
          </div>
        )}

        {!error && shown.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            <Activity size={36} className="text-[var(--ash-gray)]" />
            <p className="text-sm text-[var(--ash-medium)]">No activity logged yet.</p>
            <p className="text-xs text-[var(--ash-medium)]">
              Events will appear here when you upload documents, run extraction, and more.
            </p>
          </div>
        )}

        {shown.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--ash-gray)] bg-[var(--ash-light)] sticky top-0 z-10">
                <th className="text-left text-xs font-semibold text-[var(--ash-medium)] px-4 py-2.5 w-32">
                  Time
                </th>
                <th className="text-left text-xs font-semibold text-[var(--ash-medium)] px-4 py-2.5 w-20">
                  Level
                </th>
                <th className="text-left text-xs font-semibold text-[var(--ash-medium)] px-4 py-2.5 w-48">
                  Event
                </th>
                <th className="text-left text-xs font-semibold text-[var(--ash-medium)] px-4 py-2.5">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((log, i) => (
                <tr
                  key={log.id}
                  className={`border-b border-[var(--ash-gray)]/60 hover:bg-[var(--ash-light)] transition-colors ${
                    log.level === 'ERROR'
                      ? 'bg-red-50/40'
                      : log.level === 'WARNING'
                        ? 'bg-amber-50/40'
                        : i % 2 === 0
                          ? 'bg-white'
                          : 'bg-[var(--ash-light)]/50'
                  }`}
                >
                  <td className="px-4 py-2.5 align-top">
                    <span
                      title={formatAbsolute(log.created_at)}
                      className="text-xs text-[var(--ash-medium)] cursor-default whitespace-nowrap"
                    >
                      {relativeTime(log.created_at)}
                    </span>
                    <div className="text-[10px] text-[var(--ash-medium)]/70 mt-0.5">
                      {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <LevelBadge level={log.level} />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <EventChip type={log.event_type} />
                  </td>
                  <td className="px-4 py-2.5 align-top text-[var(--ash-charcoal)] text-xs leading-relaxed">
                    {log.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
