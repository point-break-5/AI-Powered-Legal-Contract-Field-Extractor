'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Upload, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, type EvaluationReport } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export default function EvalPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.evaluation.report(projectId)
      .then(setReport)
      .catch(() => {}) // 404 = no labels yet
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await api.evaluation.upload(projectId, file);
      const r = await api.evaluation.report(projectId);
      setReport(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ash-black)]">Evaluation</h1>
          <p className="text-sm text-[var(--ash-dark)] mt-1">
            Upload a CSV of human labels to measure extraction accuracy.
          </p>
        </div>
        <div className="flex gap-2">
          {report && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoading(true);
                api.evaluation.report(projectId).then(setReport).finally(() => setLoading(false));
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
          )}
          <Button size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload size={13} />
            Upload Labels CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* CSV format hint */}
      <div className="mb-6 bg-[var(--ash-light)] border border-[var(--ash-gray)] rounded-[var(--radius-lg)] px-4 py-3">
        <p className="text-xs font-semibold text-[var(--ash-deep)] mb-1">Required CSV format</p>
        <code className="text-[11px] text-[var(--ash-charcoal)] font-mono">
          document_filename, field_key, expected_value
        </code>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--accent-coral)] bg-[var(--accent-coral)]/10 border border-[var(--accent-coral)]/30 px-4 py-3 rounded-[var(--radius-md)]">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !report ? (
        <div className="text-center py-16 text-sm text-[var(--ash-dark)]">
          No evaluation labels uploaded yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Overall Accuracy" value={pct(report.overall_accuracy_pct)} note={`${report.total_matched}/${report.total_labels} matched`} good={report.overall_accuracy_pct >= 70} />
            <MetricCard label="Coverage" value={pct(report.overall_coverage_pct)} note="Non-null extractions" good={report.overall_coverage_pct >= 80} />
            <MetricCard label="Normalisation" value={pct(report.normalization_validity_pct)} note="Norm. value matches" good={report.normalization_validity_pct >= 70} />
          </div>

          {/* Per-field breakdown */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--ash-black)] mb-3">Per-field Accuracy</h2>
            <div className="bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--ash-light)] border-b border-[var(--ash-gray)]">
                    <th className="text-left px-4 py-2.5 font-semibold text-[var(--ash-charcoal)]">Field</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[var(--ash-charcoal)]">Matched</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-[var(--ash-charcoal)]">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {report.per_field.map(row => (
                    <tr key={row.field_key} className="border-b border-[var(--ash-gray)] last:border-b-0">
                      <td className="px-4 py-2.5 font-mono text-[var(--ash-deep)]">{row.field_key}</td>
                      <td className="text-right px-4 py-2.5 text-[var(--ash-charcoal)]">{row.matched}/{row.total}</td>
                      <td className="text-right px-4 py-2.5 font-semibold">
                        <span style={{ color: row.accuracy_pct >= 70 ? 'var(--accent-teal)' : row.accuracy_pct >= 40 ? 'var(--accent-amber)' : 'var(--accent-coral)' }}>
                          {pct(row.accuracy_pct)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side-by-side */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--ash-black)] mb-3">Side-by-side Comparison</h2>
            <div className="bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] overflow-auto max-h-96">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[var(--ash-light)] border-b border-[var(--ash-gray)]">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-[var(--ash-charcoal)]">Document</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[var(--ash-charcoal)]">Field</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[var(--ash-charcoal)]">Expected</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[var(--ash-charcoal)]">AI Value</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-[var(--ash-charcoal)]">Normalised</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-[var(--ash-charcoal)]">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {report.side_by_side.map((row, i) => (
                    <tr key={i} className={`border-b border-[var(--ash-gray)] last:border-b-0 ${row.match ? '' : 'bg-[var(--accent-coral)]/5'}`}>
                      <td className="px-3 py-2 text-[var(--ash-charcoal)] truncate max-w-[120px]" title={row.document}>{row.document}</td>
                      <td className="px-3 py-2 font-mono text-[var(--ash-deep)]">{row.field_key}</td>
                      <td className="px-3 py-2 text-[var(--ash-black)] font-medium">{row.expected_value}</td>
                      <td className="px-3 py-2 text-[var(--ash-charcoal)]">{row.ai_value ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--ash-charcoal)]">{row.normalized_value ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {row.match
                          ? <CheckCircle2 size={13} className="inline text-[var(--accent-teal)]" />
                          : <AlertCircle size={13} className="inline text-[var(--accent-coral)]" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, note, good }: { label: string; value: string; note: string; good: boolean }) {
  return (
    <div className="bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] px-4 py-4">
      <p className="text-[11px] text-[var(--ash-dark)]">{label}</p>
      <p className="text-2xl font-semibold mt-1" style={{ color: good ? 'var(--accent-teal)' : 'var(--accent-coral)' }}>
        {value}
      </p>
      <p className="text-[11px] text-[var(--ash-medium)] mt-0.5">{note}</p>
    </div>
  );
}
