import { getSession, canEditDashboard } from '@/lib/auth';
import { listDashboardsVisibleTo } from '@/lib/db';
import { DashboardListClient } from '@/components/dashboard/DashboardListClient';

export default async function DashboardsPage() {
  const user = await getSession();
  if (!user) return null;

  const dashboards = await listDashboardsVisibleTo(user);

  const canEdit = canEditDashboard(user.role);

  return <DashboardListClient initial={dashboards} canEdit={canEdit} />;
}
