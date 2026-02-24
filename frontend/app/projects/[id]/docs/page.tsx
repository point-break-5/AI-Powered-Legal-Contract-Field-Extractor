'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Upload, Trash2, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { api, type Document } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export default function DocsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    api.documents.list(projectId).then(setDocs).finally(() => setLoading(false));
  }, [projectId]);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setErrors([]);
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const newDocs: Document[] = [];
    const newErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      try {
        const doc = await api.documents.upload(projectId, files[i]);
        newDocs.push(doc);
      } catch (err: unknown) {
        newErrors.push(`${files[i].name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
      }
    }

    if (newDocs.length > 0) setDocs(prev => [...prev, ...newDocs]);
    if (newErrors.length > 0) setErrors(newErrors);
    setUploading(false);
    setUploadProgress(null);
  }

  async function handleDelete(docId: number) {
    if (!confirm('Remove this document?')) return;
    await api.documents.delete(projectId, docId).catch(() => {});
    setDocs(prev => prev.filter(d => d.id !== docId));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--ash-black)]">Documents</h1>
        <p className="text-sm text-[var(--ash-dark)] mt-1">
          Upload PDF, DOCX, HTML, or TXT contracts to parse and extract fields from.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`mb-6 border-2 border-dashed rounded-[var(--radius-xl)] p-10 flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 ${
          dragOver
            ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/5'
            : 'border-[var(--ash-gray)] bg-white hover:border-[var(--accent-blue)]/50 hover:bg-[var(--ash-light)]'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.html,.htm,.txt"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) uploadFiles(files);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            {uploadProgress && (
              <p className="text-xs text-[var(--ash-dark)]">
                Uploading {uploadProgress.current} of {uploadProgress.total}…
              </p>
            )}
          </div>
        ) : (
          <>
            <Upload size={28} className="text-[var(--ash-medium)] mb-3" />
            <p className="text-sm font-medium text-[var(--ash-charcoal)]">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-[var(--ash-dark)] mt-1">
              PDF · DOCX · HTML · TXT · Multiple files supported
            </p>
          </>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5 text-sm text-[var(--accent-coral)] bg-[var(--accent-coral)]/10 border border-[var(--accent-coral)]/30 px-4 py-3 rounded-[var(--radius-md)]">
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--ash-dark)]">
          No documents yet — upload one above.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map(doc => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 bg-white border border-[var(--ash-gray)] rounded-[var(--radius-lg)] px-4 py-3 animate-fade-in"
            >
              <FileText size={16} className="text-[var(--ash-dark)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ash-black)] truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-[var(--ash-dark)]">
                  {doc.format.toUpperCase()} · {formatDate(doc.created_at)}
                </p>
              </div>
              {doc.parse_status === 'PARSING' ? (
                <Loader2 size={14} className="animate-spin text-[var(--accent-amber)]" />
              ) : (
                <Badge status={doc.parse_status} />
              )}
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-1 rounded text-[var(--ash-medium)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
