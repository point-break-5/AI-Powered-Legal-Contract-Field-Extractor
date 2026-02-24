'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2, Save, AlertCircle, Info, LayoutTemplate } from 'lucide-react';
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

const PRESETS: { id: string; label: string; description: string; fields: FieldDefinition[] }[] = [
  {
    id: 'general_contract',
    label: 'General Contract',
    description: 'Parties, dates, value, governing law',
    fields: [
      { key: 'party_a', type: 'entity', description: 'First party named in the contract', required: true },
      { key: 'party_b', type: 'entity', description: 'Second party named in the contract', required: true },
      { key: 'effective_date', type: 'date', description: 'Date the agreement takes effect', required: true },
      { key: 'expiry_date', type: 'date', description: 'Date the agreement expires or terminates', required: false },
      { key: 'contract_value', type: 'amount', description: 'Total monetary value or consideration of the contract', required: false },
      { key: 'governing_law', type: 'text', description: 'Jurisdiction whose laws govern the contract', required: false },
    ],
  },
  {
    id: 'nda',
    label: 'NDA',
    description: 'Non-disclosure agreement',
    fields: [
      { key: 'disclosing_party', type: 'entity', description: 'Party disclosing confidential information', required: true },
      { key: 'receiving_party', type: 'entity', description: 'Party receiving confidential information', required: true },
      { key: 'effective_date', type: 'date', description: 'Date the NDA takes effect', required: true },
      { key: 'expiry_date', type: 'date', description: 'Expiration date of NDA obligations', required: false },
      { key: 'confidential_information', type: 'text', description: 'Definition of what constitutes confidential information', required: true },
      { key: 'purpose', type: 'text', description: 'The permitted purpose for disclosure', required: false },
      { key: 'governing_law', type: 'text', description: 'Jurisdiction governing the NDA', required: false },
    ],
  },
  {
    id: 'employment',
    label: 'Employment',
    description: 'Role, salary, duration, notice period',
    fields: [
      { key: 'employee_name', type: 'entity', description: 'Full legal name of the employee', required: true },
      { key: 'employer_name', type: 'entity', description: 'Full legal name of the employer', required: true },
      { key: 'job_title', type: 'text', description: 'Position or role title', required: true },
      { key: 'start_date', type: 'date', description: 'Employment commencement date', required: true },
      { key: 'end_date', type: 'date', description: 'Employment end date (for fixed-term contracts)', required: false },
      { key: 'salary', type: 'amount', description: 'Annual or monthly gross salary', required: false },
      { key: 'notice_period', type: 'text', description: 'Required notice period for termination', required: false },
      { key: 'governing_law', type: 'text', description: 'Jurisdiction governing the employment contract', required: false },
    ],
  },
  {
    id: 'service_agreement',
    label: 'Service Agreement',
    description: 'Scope, deliverables, payment, IP',
    fields: [
      { key: 'service_provider', type: 'entity', description: 'Party providing the services', required: true },
      { key: 'client', type: 'entity', description: 'Client receiving the services', required: true },
      { key: 'scope_of_services', type: 'text', description: 'Description of services to be provided', required: true },
      { key: 'start_date', type: 'date', description: 'Date services commence', required: true },
      { key: 'end_date', type: 'date', description: 'Date services end or project completion', required: false },
      { key: 'total_fee', type: 'amount', description: 'Total fee or contract value for the services', required: false },
      { key: 'payment_terms', type: 'text', description: 'Payment schedule and terms', required: false },
      { key: 'ip_ownership', type: 'text', description: 'Who owns intellectual property created during the engagement', required: false },
      { key: 'governing_law', type: 'text', description: 'Jurisdiction governing the agreement', required: false },
    ],
  },
  {
    id: 'lease',
    label: 'Lease Agreement',
    description: 'Property, rent, term, deposit',
    fields: [
      { key: 'landlord', type: 'entity', description: 'Name of the landlord or lessor', required: true },
      { key: 'tenant', type: 'entity', description: 'Name of the tenant or lessee', required: true },
      { key: 'property_address', type: 'text', description: 'Full address of the leased property', required: true },
      { key: 'lease_start_date', type: 'date', description: 'Lease commencement date', required: true },
      { key: 'lease_end_date', type: 'date', description: 'Lease expiration date', required: true },
      { key: 'monthly_rent', type: 'amount', description: 'Monthly rental amount', required: true },
      { key: 'security_deposit', type: 'amount', description: 'Security deposit amount', required: false },
      { key: 'governing_law', type: 'text', description: 'Jurisdiction governing the lease', required: false },
    ],
  },
];

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

  function loadPreset(preset: typeof PRESETS[number]) {
    const isBlank = fields.length === 1 && !fields[0].key && !fields[0].description;
    if (!isBlank) {
      if (!confirm(`Replace current fields with the "${preset.label}" preset?`)) return;
    }
    setFields(preset.fields);
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
    <div className="p-8 max-w-2xl mx-auto">
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

      {/* Presets */}
      <div className="mb-5 bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutTemplate size={14} className="text-[var(--accent-blue)]" />
          <span className="text-xs font-semibold text-[var(--ash-charcoal)]">Presets</span>
          <span className="text-[11px] text-[var(--ash-dark)]">— click to load a predefined field set</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset)}
              className="group flex flex-col items-start px-3 py-2 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-[var(--ash-white)] hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/5 transition-all text-left"
            >
              <span className="text-xs font-semibold text-[var(--ash-black)] group-hover:text-[var(--accent-blue)] transition-colors">
                {preset.label}
              </span>
              <span className="text-[11px] text-[var(--ash-dark)] mt-0.5">
                {preset.description}
              </span>
              <span className="text-[10px] text-[var(--ash-medium)] mt-1">
                {preset.fields.length} fields
              </span>
            </button>
          ))}
        </div>
      </div>

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
