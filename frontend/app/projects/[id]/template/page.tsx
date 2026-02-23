'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2, Save, AlertCircle, Info } from 'lucide-react';
import { api, type FieldDefinition, type Template } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const FIELD_TYPES: FieldDefinition['type'][] = ['text', 'date', 'amount', 'entity'];

const emptyField = (): FieldDefinition => ({
  key: '',
  type: 'text',
  description: '',
  required: false,
});

export default function TemplatePage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([emptyField()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.template.get(projectId)
      .then(t => { setTemplate(t); setFields(t.fields.length ? t.fields : [emptyField()]); })
      .catch(() => {}) // 404 = no template yet, that's fine
      .finally(() => setLoading(false));
  }, [projectId]);

  function updateField(i: number, patch: Partial<FieldDefinition>) {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }

  function addField() {
    setFields(prev => [...prev, emptyField()]);
  }

  function removeField(i: number) {
    setFields(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setError('');
    // Validate
    for (const f of fields) {
      if (!f.key.trim()) { setError('All fields must have a key.'); return; }
    }
    const keys = fields.map(f => f.key.trim());
    if (new Set(keys).size !== keys.length) { setError('Field keys must be unique.'); return; }

    if (template && template.version > 0) {
      if (!confirm('Saving will bump the template version and mark all existing extraction records as STALE. Continue?')) return;
    }

    setSaving(true);
    try {
      const t = await api.template.upsert(projectId, fields);
      setTemplate(t);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  );

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--ash-black)]">Field Template</h1>
          <p className="text-sm text-[var(--ash-dark)] mt-1">
            Define which fields to extract from your contracts.
            {template && (
              <span className="ml-2 text-[var(--ash-medium)]">Version {template.version}</span>
            )}
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          <Save size={14} />
          {saved ? 'Saved!' : 'Save Template'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--accent-coral)] bg-[var(--accent-coral)]/10 border border-[var(--accent-coral)]/30 px-4 py-3 rounded-[var(--radius-md)]">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {template && (
        <div className="mb-4 flex items-start gap-2 text-xs text-[var(--ash-dark)] bg-[var(--ash-light)] border border-[var(--ash-gray)] px-4 py-3 rounded-[var(--radius-md)]">
          <Info size={13} className="mt-0.5 shrink-0" />
          Saving a new version will mark existing extraction records as <strong className="text-[var(--ash-deep)]">STALE</strong>. Use <strong className="text-[var(--ash-deep)]">Re-extract All</strong> on the Review Table page to refresh them.
        </div>
      )}

      {/* Field list */}
      <div className="flex flex-col gap-3">
        {fields.map((field, i) => (
          <div
            key={i}
            className="bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] p-4 animate-fade-in"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-[var(--ash-dark)] w-5 text-right">{i + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="field_key (snake_case)"
                  value={field.key}
                  onChange={e => updateField(i, { key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                  className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-[var(--ash-white)] text-[var(--ash-charcoal)] placeholder:text-[var(--ash-dark)] focus:outline-none focus-visible:border-[var(--accent-blue)] focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/30 transition font-mono"
                />
                <select
                  value={field.type}
                  onChange={e => updateField(i, { type: e.target.value as FieldDefinition['type'] })}
                  className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-[var(--ash-white)] text-[var(--ash-charcoal)] focus:outline-none focus-visible:border-[var(--accent-blue)] transition"
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button
                onClick={() => removeField(i)}
                className="p-1.5 rounded text-[var(--ash-medium)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/10 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <input
                type="text"
                placeholder="Description (used as extraction hint)"
                value={field.description}
                onChange={e => updateField(i, { description: e.target.value })}
                className="flex-1 text-sm px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-[var(--ash-white)] text-[var(--ash-charcoal)] placeholder:text-[var(--ash-dark)] focus:outline-none focus-visible:border-[var(--accent-blue)] focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/30 transition"
              />
              <label className="flex items-center gap-1.5 text-xs text-[var(--ash-charcoal)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={e => updateField(i, { required: e.target.checked })}
                  className="accent-[var(--accent-blue)]"
                />
                Required
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addField}
        className="mt-3 flex items-center gap-1.5 text-sm text-[var(--accent-blue)] hover:text-[var(--accent-blue)]/80 font-medium transition-colors"
      >
        <Plus size={15} />
        Add Field
      </button>
    </div>
  );
}
