'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { FileText, Settings, Table2, BarChart2, ChevronLeft, Scale } from 'lucide-react';
import { api } from '@/lib/api';

const NAV_ITEMS = [
  { segment: 'docs',     icon: FileText, label: 'Documents'    },
  { segment: 'template', icon: Settings, label: 'Template'     },
  { segment: 'table',    icon: Table2,   label: 'Review Table' },
  { segment: 'eval',     icon: BarChart2,label: 'Evaluate'     },
];

export function ProjectShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = params?.id ?? '';
  const projectId = Number(id);

  const [projectName, setProjectName] = useState<string>('');

  useEffect(() => {
    if (!projectId) return;
    api.projects.get(projectId).then(p => setProjectName(p.name)).catch(() => {});
  }, [projectId]);

  return (
    <div className="flex min-h-screen bg-[var(--ash-white)]">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-white border-r border-[var(--ash-gray)] flex flex-col fixed top-0 bottom-0">
        {/* Brand / back */}
        <div className="px-3 h-14 flex items-center gap-2 border-b border-[var(--ash-gray)]">
          <Link
            href="/"
            title="All Projects"
            className="p-1 rounded-[var(--radius-sm)] text-[var(--ash-dark)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
          </Link>
          <Scale size={17} className="text-[var(--accent-blue)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--ash-black)] truncate flex-1">
            {projectName || 'Loading…'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ segment, icon: Icon, label }) => {
            const active = pathname.includes(`/${segment}`);
            return (
              <Link
                key={segment}
                href={`/projects/${id}/${segment}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                    : 'text-[var(--ash-charcoal)] hover:bg-[var(--ash-light)] hover:text-[var(--ash-black)]'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--ash-gray)] text-[10px] text-[var(--ash-medium)] text-center select-none">
          AI Legal Extractor
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 ml-56 min-w-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
