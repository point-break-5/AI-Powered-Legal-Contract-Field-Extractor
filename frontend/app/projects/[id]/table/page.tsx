'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Zap, Download, X, Check, XCircle, Pencil, ExternalLink } from 'lucide-react';
import { api, type TableCell, type TableData, type ExtractionRecord, type LLMProvider, LLM_PROVIDER_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { confidenceColor } from '@/lib/utils';

export default function TablePage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [activeCell, setActiveCell] = useState<{
    cell: TableCell;
    fieldKey: string;
    docName: string;
  } | null>(null);

  // Review state
  const [reviewing, setReviewing] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>('gemini');
  const panelRef = useRef<HTMLDivElement>(null);

  const loadTable = useCallback(() => {
    setLoading(true);
    api.review.table(projectId)
      .then(setTableData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadTable(); }, [loadTable]);

  async function handleExtractAll() {
    setExtracting(true);
    setError('');
    try {
      await api.extraction.extractAll(projectId, provider);
      loadTable();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleReview(status: string, mv?: string) {
    if (!activeCell?.cell.record_id) return;
    setReviewing(true);
    try {
      const updated = await api.review.update(projectId, activeCell.cell.record_id, status, mv);
      // Patch the cell in table data
      setTableData(prev => {
        if (!prev) return prev;
        const rows = { ...prev.rows };
        const fieldRow = { ...rows[activeCell.fieldKey] };
        const docEntry = Object.entries(prev.documents).find(([, d]) => d.filename === activeCell.docName);
        if (docEntry) {
          const docId = String(prev.documents.find(d => d.filename === activeCell.docName)?.id);
          if (docId && fieldRow[docId]) {
            fieldRow[docId] = { ...fieldRow[docId]!, review_status: updated.review_status, manual_value: updated.manual_value };
          }
        }
        rows[activeCell.fieldKey] = fieldRow;
        return { ...prev, rows };
      });
      setActiveCell(prev => prev ? { ...prev, cell: { ...prev.cell, review_status: updated.review_status as TableCell['review_status'], manual_value: updated.manual_value } } : null);
      setShowManual(false);
      setManualValue('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setReviewing(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Main table ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-[var(--ash-gray)] px-6 py-3 flex items-center gap-3 shrink-0">
          <h1 className="text-base font-semibold text-[var(--ash-black)] flex-1">
            Review Table
          </h1>
          {error && (
            <span className="text-xs text-[var(--accent-coral)] flex-1">{error}</span>
          )}
          <a href={api.export.url(projectId, 'csv')} download className="shrink-0">
            <Button variant="secondary" size="sm">
              <Download size={13} />
              CSV
            </Button>
          </a>
          <a href={api.export.url(projectId, 'xlsx')} download className="shrink-0">
            <Button variant="secondary" size="sm">
              <Download size={13} />
              Excel
            </Button>
          </a>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as LLMProvider)}
            className="text-xs px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-white text-[var(--ash-charcoal)] focus:outline-none focus-visible:border-[var(--accent-blue)] focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/30 transition shrink-0 cursor-pointer"
            title="LLM Provider"
          >
            {(Object.entries(LLM_PROVIDER_LABELS) as [LLMProvider, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Button size="sm" loading={extracting} onClick={handleExtractAll}>
            <Zap size={13} />
            Re-extract All
          </Button>
        </div>

        {/* Table */}
        {!tableData || tableData.documents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-[var(--ash-dark)]">
            <p>No documents or extractions yet.</p>
            <p className="text-xs">Upload documents and run Re-extract All.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--ash-light)]">
                <tr>
                  <th className="sticky left-0 bg-[var(--ash-light)] text-left px-4 py-3 font-semibold text-[var(--ash-charcoal)] border-b border-r border-[var(--ash-gray)] min-w-[160px] z-20">
                    Field
                  </th>
                  {tableData.documents.map(doc => (
                    <th
                      key={doc.id}
                      className="px-3 py-3 font-medium text-[var(--ash-charcoal)] border-b border-r border-[var(--ash-gray)] max-w-[180px] text-left whitespace-nowrap"
                    >
                      <span className="block truncate max-w-[160px]" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.fields.map((fieldKey, fi) => (
                  <tr
                    key={fieldKey}
                    className={fi % 2 === 0 ? 'bg-white' : 'bg-[var(--ash-white)]'}
                  >
                    <td className="sticky left-0 bg-inherit px-4 py-3 font-mono font-medium text-[var(--ash-deep)] border-b border-r border-[var(--ash-gray)] z-10">
                      {fieldKey}
                    </td>
                    {tableData.documents.map(doc => {
                      const cell = tableData.rows[fieldKey]?.[String(doc.id)] ?? null;
                      if (!cell) {
                        return (
                          <td key={doc.id} className="px-3 py-3 border-b border-r border-[var(--ash-gray)] text-[var(--ash-medium)]">
                            —
                          </td>
                        );
                      }
                      const displayVal = cell.manual_value ?? cell.normalized_value ?? cell.value;
                      const color = confidenceColor(cell.confidence);
                      return (
                        <td
                          key={doc.id}
                          className="px-3 py-3 border-b border-r border-[var(--ash-gray)] cursor-pointer hover:bg-[var(--accent-blue)]/5 transition-colors max-w-[200px]"
                          onClick={() => setActiveCell({ cell, fieldKey, docName: doc.filename })}
                        >
                          <div className="flex items-start gap-1.5">
                            <div
                              className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                              title={`Confidence: ${cell.confidence != null ? (cell.confidence * 100).toFixed(0) + '%' : 'N/A'}`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[var(--ash-charcoal)] font-medium max-w-[150px]">
                                {displayVal ?? <span className="text-[var(--ash-medium)]">—</span>}
                              </p>
                              <Badge status={cell.review_status} className="mt-0.5" />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Side panel ── */}
      {activeCell && (
        <div
          ref={panelRef}
          className="w-72 shrink-0 bg-white border-l border-[var(--ash-gray)] flex flex-col animate-fade-in overflow-y-auto"
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-[var(--ash-gray)] flex items-start justify-between">
            <div>
              <p className="text-xs font-mono font-semibold text-[var(--ash-black)]">
                {activeCell.fieldKey}
              </p>
              <p className="text-[11px] text-[var(--ash-dark)] mt-0.5 truncate max-w-[190px]">
                {activeCell.docName}
              </p>
            </div>
            <button onClick={() => setActiveCell(null)} className="p-1 rounded hover:bg-[var(--ash-light)] text-[var(--ash-dark)] transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Values */}
          <div className="px-4 py-4 flex flex-col gap-3 flex-1">
            <Row label="AI Value" value={activeCell.cell.value} />
            <Row label="Normalised" value={activeCell.cell.normalized_value} />
            {activeCell.cell.manual_value && (
              <Row label="Manual Override" value={activeCell.cell.manual_value} highlight />
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--ash-dark)]">Confidence</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: confidenceColor(activeCell.cell.confidence) }}
              >
                {activeCell.cell.confidence != null
                  ? `${(activeCell.cell.confidence * 100).toFixed(0)}%`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--ash-dark)]">Status</span>
              <Badge status={activeCell.cell.review_status} />
            </div>

            {/* Citations */}
            {activeCell.cell.citations.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[var(--ash-dark)] mb-1.5">Citations</p>
                <div className="flex flex-col gap-2">
                  {activeCell.cell.citations.map((c, i) => (
                    <div key={i} className="bg-[var(--ash-light)] rounded-[var(--radius-sm)] px-3 py-2 text-[11px]">
                      {c.page && <span className="text-[var(--accent-blue)] font-medium">p.{c.page} </span>}
                      <span className="text-[var(--ash-charcoal)] italic">"{c.excerpt}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual value input */}
            {showManual && (
              <div className="mt-1">
                <textarea
                  rows={2}
                  placeholder="Enter correct value…"
                  value={manualValue}
                  onChange={e => setManualValue(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-[var(--ash-white)] text-[var(--ash-charcoal)] placeholder:text-[var(--ash-dark)] focus:outline-none focus-visible:border-[var(--accent-blue)] focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/30 resize-none transition"
                />
                <div className="flex gap-2 mt-1.5">
                  <Button
                    size="sm"
                    className="flex-1"
                    loading={reviewing}
                    onClick={() => handleReview('MANUAL_UPDATED', manualValue)}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => { setShowManual(false); setManualValue(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Review actions */}
          {!showManual && activeCell.cell.record_id && (
            <div className="px-4 py-3 border-t border-[var(--ash-gray)] flex flex-col gap-2">
              <Button
                size="sm"
                variant="primary"
                className="w-full"
                loading={reviewing}
                onClick={() => handleReview('CONFIRMED')}
              >
                <Check size={13} />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                loading={reviewing}
                onClick={() => handleReview('REJECTED')}
              >
                <XCircle size={13} />
                Reject
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => setShowManual(true)}
              >
                <Pencil size={13} />
                Edit Manually
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-[var(--ash-dark)] mb-0.5">{label}</p>
      <p className={`text-xs font-medium break-words ${highlight ? 'text-[var(--accent-blue)]' : 'text-[var(--ash-black)]'}`}>
        {value}
      </p>
    </div>
  );
}
