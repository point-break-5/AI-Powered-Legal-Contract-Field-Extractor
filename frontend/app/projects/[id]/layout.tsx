import { ProjectShell } from '@/components/ProjectShell';
import { NavGuardProvider } from '@/lib/nav-guard';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavGuardProvider>
      <ProjectShell>{children}</ProjectShell>
    </NavGuardProvider>
  );
}
