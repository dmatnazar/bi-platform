import { notFound, redirect } from 'next/navigation';
import { getSession, canEditDashboard } from '@/lib/auth';
import { getDashboard, userCanViewDashboard } from '@/lib/db';
import { DashboardView } from '@/components/dashboard/DashboardView';

type Props = { params: Promise<{ id: string }> };

export default async function DashboardPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect('/login');

  const { id } = await params;
  const dashboard = await getDashboard(id);
  if (!dashboard) notFound();

  if (!userCanViewDashboard(user, dashboard)) {
    notFound();
  }

  const editable = canEditDashboard(user.role);

  return <DashboardView initial={dashboard} editable={editable} />;
}
