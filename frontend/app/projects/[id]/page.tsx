import { redirect } from 'next/navigation';

export default function ProjectRoot({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/docs`);
}
