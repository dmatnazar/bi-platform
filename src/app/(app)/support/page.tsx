import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { SupportChat } from '@/components/support/SupportChat';

export default async function SupportPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base sm:text-2xl font-bold text-white tracking-tight truncate leading-tight">Goldaw / Chat</h1>
        <p className="text-sm text-slate-400 mt-1">
          Diňe adminlere ýazyp bilersiňiz — teklip, säwlik, sorag we maslahat.
        </p>
      </div>
      <SupportChat mode="user" />
    </div>
  );
}
