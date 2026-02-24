/**
 * Typed API client for the Legal Contract Extractor backend.
 * Base URL is controlled by NEXT_PUBLIC_API_URL (default: http://localhost:8000).
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Project {
  id: number;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  project_id: number;
  filename: string;
  format: string;
  parse_status: 'QUEUED' | 'PARSING' | 'DONE' | 'ERROR';
  created_at: string;
}

export interface FieldDefinition {
  key: string;
  type: 'text' | 'date' | 'amount' | 'entity';
  description: string;
  required: boolean;
}

export interface Template {
  id: number;
  project_id: number;
  fields: FieldDefinition[];
  version: number;
  updated_at: string;
}

export interface Citation {
  page: string;
  excerpt: string;
}

export type ReviewStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'MANUAL_UPDATED'
  | 'MISSING_DATA'
  | 'STALE';

export interface ExtractionRecord {
  id: number;
  document_id: number;
  field_key: string;
  value: string | null;
  raw_text: string | null;
  citations: Citation[];
  confidence: number | null;
  normalized_value: string | null;
  review_status: ReviewStatus;
  manual_value: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableCell {
  record_id: number | null;
  value: string | null;
  normalized_value: string | null;
  confidence: number | null;
  review_status: ReviewStatus;
  citations: Citation[];
  manual_value: string | null;
}

export interface TableData {
  project_id: number;
  fields: string[];
  documents: { id: number; filename: string }[];
  rows: Record<string, Record<string, TableCell | null>>;
}

export interface EvaluationReport {
  project_id: number;
  total_labels: number;
  total_matched: number;
  overall_accuracy_pct: number;
  overall_coverage_pct: number;
  normalization_validity_pct: number;
  per_field: {
    field_key: string;
    total: number;
    matched: number;
    accuracy_pct: number;
  }[];
  side_by_side: {
    document: string;
    field_key: string;
    expected_value: string;
    ai_value: string | null;
    normalized_value: string | null;
    match: boolean;
  }[];
}

export type LLMProvider = 'gemini' | 'grok' | 'deepseek';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface ProjectLog {
  id: number;
  project_id: number;
  level: LogLevel;
  event_type: string;
  message: string;
  created_at: string;
}

export const LLM_PROVIDER_LABELS: Record<LLMProvider, string> = {
  gemini: 'Gemini 2.5 Flash',
  grok: 'Grok (xAI)',
  deepseek: 'DeepSeek Chat',
};

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  // Don't set Content-Type for FormData — browser sets it with boundary
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    signal,
    body: isFormData
      ? (body as FormData)
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`);
  return data as T;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const api = {
  projects: {
    list: () => request<Project[]>('GET', '/projects'),
    create: (name: string) => request<Project>('POST', '/projects', { name }),
    get: (id: number) => request<Project>('GET', `/projects/${id}`),
    delete: (id: number) => request<void>('DELETE', `/projects/${id}`),
  },

  documents: {
    list: (projectId: number) =>
      request<Document[]>('GET', `/projects/${projectId}/documents`),
    upload: (projectId: number, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<Document>('POST', `/projects/${projectId}/documents`, fd, true);
    },
    delete: (projectId: number, docId: number) =>
      request<void>('DELETE', `/projects/${projectId}/documents/${docId}`),
  },

  template: {
    get: (projectId: number) =>
      request<Template>('GET', `/projects/${projectId}/template`),
    upsert: (projectId: number, fields: FieldDefinition[]) =>
      request<Template>('POST', `/projects/${projectId}/template`, { fields }),
    delete: (projectId: number) =>
      request<void>('DELETE', `/projects/${projectId}/template`),
  },

  extraction: {
    extractAll: (projectId: number, provider: LLMProvider = 'gemini', signal?: AbortSignal) =>
      request<ExtractionRecord[]>('POST', `/projects/${projectId}/extract/all?provider=${provider}`, undefined, false, signal),
    extractField: (projectId: number, document_id: number, field_key: string, provider: LLMProvider = 'gemini') =>
      request<ExtractionRecord>('POST', `/projects/${projectId}/extract/field`, {
        document_id,
        field_key,
        provider,
      }),
    clearAll: (projectId: number) =>
      request<void>('DELETE', `/projects/${projectId}/extract/all`),
  },

  review: {
    update: (
      projectId: number,
      recordId: number,
      status: string,
      manual_value?: string,
    ) =>
      request<ExtractionRecord>(
        'POST',
        `/projects/${projectId}/records/${recordId}/review`,
        { status, manual_value: manual_value ?? null },
      ),
    list: (projectId: number, status?: string) =>
      request<ExtractionRecord[]>(
        'GET',
        `/projects/${projectId}/records${status ? `?status=${status}` : ''}`,
      ),
    table: (projectId: number) =>
      request<TableData>('GET', `/projects/${projectId}/table`),
  },

  export: {
    url: (projectId: number, format: 'csv' | 'xlsx', scope: 'all' | 'table' = 'all') =>
      `${BASE}/projects/${projectId}/export?format=${format}&scope=${scope}`,
  },

  evaluation: {
    upload: (projectId: number, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<{ project_id: number; labels_uploaded: number }>(
        'POST',
        `/projects/${projectId}/evaluation/upload`,
        fd,
        true,
      );
    },
    report: (projectId: number) =>
      request<EvaluationReport>('GET', `/projects/${projectId}/evaluation/report`),
  },

  logs: {
    list: (projectId: number, level?: LogLevel) =>
      request<ProjectLog[]>(
        'GET',
        `/projects/${projectId}/logs${level ? `?level=${level}` : ''}`,
      ),
    clear: (projectId: number) =>
      request<void>('DELETE', `/projects/${projectId}/logs`),
  },
};
