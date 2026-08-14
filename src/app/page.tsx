import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

/**
 * Root route: always redirect (login or dashboards).
 * Avoids blank 404 when session check is slow / fails.
 */
export default async function Home() {
  try {
    const user = await getSession();
    if (user) redirect('/dashboards');
  } catch {
    /* fall through to login */
  }
  redirect('/login');
}
