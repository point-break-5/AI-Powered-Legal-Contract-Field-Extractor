'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, Plus, Trash2, FolderOpen } from 'lucide-react';
import { api, type Project } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.projects.list().then(setProjects).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const p = await api.projects.create(newName.trim());
      setProjects(prev => [p, ...prev]);
      setNewName('');
      setShowForm(false);
      router.push(`/projects/${p.id}/docs`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this project and all its data?')) return;
    await api.projects.delete(id).catch(() => {});
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="min-h-screen bg-[var(--ash-white)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--ash-gray)] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Scale size={20} className="text-[var(--accent-blue)]" />
          <span className="text-base font-semibold text-[var(--ash-black)]">
            Legal Contract Extractor
          </span>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} />
          New Project
        </Button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* New project form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] p-5 animate-fade-in shadow-xs"
          >
            <h2 className="text-sm font-semibold text-[var(--ash-black)] mb-3">
              New Project
            </h2>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="e.g. Tesla Q3 Contracts"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-[var(--radius-md)] border border-[var(--ash-gray)] bg-[var(--ash-white)] text-[var(--ash-charcoal)] placeholder:text-[var(--ash-dark)] focus:outline-none focus-visible:border-[var(--accent-blue)] focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/30 transition"
              />
              <Button type="submit" loading={creating}>
                Create
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-[var(--accent-coral)]">{error}</p>
            )}
          </form>
        )}

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--ash-black)]">
            Projects
          </h1>
          <p className="text-sm text-[var(--ash-dark)] mt-1">
            Select a project to upload documents and extract fields.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24">
            <FolderOpen size={40} className="mx-auto mb-3 text-[var(--ash-medium)]" />
            <p className="text-sm text-[var(--ash-dark)]">No projects yet.</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}/docs`)}
                className="group flex items-center gap-4 bg-white border border-[var(--ash-gray)] rounded-[var(--radius-xl)] px-5 py-4 cursor-pointer hover:border-[var(--accent-blue)]/50 hover:shadow-xs transition-all duration-200 animate-fade-in"
              >
                <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
                  <Scale size={15} className="text-[var(--accent-blue)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--ash-black)] truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-[var(--ash-dark)] mt-0.5">
                    Created {formatDate(p.created_at)}
                  </p>
                </div>
                <Badge status={p.status} />
                <button
                  onClick={e => handleDelete(p.id, e)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--ash-medium)] hover:text-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/10 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

