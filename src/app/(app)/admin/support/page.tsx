import { redirect } from 'next/navigation';
import { getSession, canEditDashboard } from '@/lib/auth';
import { SupportChat } from '@/components/support/SupportChat';

export default async function AdminSupportPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canEditDashboard(user.role) && user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'editor') {
    redirect('/support');
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base sm:text-2xl font-bold text-white tracking-tight truncate leading-tight">Goldaw dolandyryşy</h1>
        <p className="text-sm text-slate-400 mt-1">
          Ulanyjylaryň ýüzlenmeleri — jogap beriň, status üýtgediň.
        </p>
      </div>
      <SupportChat mode="admin" />
    </div>
  );
}
