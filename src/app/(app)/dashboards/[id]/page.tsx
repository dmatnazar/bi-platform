import { notFound, redirect } from 'next/navigation';
import { getSession, canEditDashboard } from '@/lib/auth';
import { getDashboard, getCompanyById, getCompanyBySlug, userCanViewDashboard } from '@/lib/db';
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

  let companyName = '';
  let companySlug = '';
  try {
    const co =
      (await getCompanyById(dashboard.companyId)) ||
      (await getCompanyBySlug(dashboard.companyId));
    companyName = co?.name || '';
    companySlug = co?.slug || '';
  } catch {
    /* */
  }

  return (
    <DashboardView
      initial={dashboard}
      editable={editable}
      companyName={companyName}
      companySlug={companySlug}
    />
  );
}
