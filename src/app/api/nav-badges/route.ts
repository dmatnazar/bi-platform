import { NextResponse } from 'next/server';
import { getSession, isSuperAdmin, canManageCompany, canManageStaff } from '@/lib/auth';
import { checkGatewayHealth, gatewayFetch, fetchCatalog } from '@/lib/gateway';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  const out = {
    devicesPending: 0,
    staffPending: 0,
    billingEmpty: 0,
  };

  try {
    if (!(await checkGatewayHealth())) {
      return NextResponse.json(out);
    }

    if (isSuperAdmin(user) || canManageCompany(user.role)) {
      try {
        const cat = await fetchCatalog(false);
        const devices = (cat as any).devices || [];
        out.devicesPending = devices.filter(
          (d: any) => String(d.status || '').toLowerCase() === 'pending'
        ).length;
      } catch {
        /* */
      }
    }

    if (isSuperAdmin(user)) {
      try {
        const ov = await gatewayFetch('GET', '/api/admin/billing/overview');
        const wallets = ov.data?.wallets || [];
        out.billingEmpty = wallets.filter(
          (w: any) => Number(w.balanceCredits) <= 0 || w.level === 'empty' || w.level === 'critical'
        ).length;
      } catch {
        /* */
      }
    }

    if (canManageStaff(user.role) || isSuperAdmin(user)) {
      try {
        const cat = await fetchCatalog(false);
        const staff = (cat as any).staff || [];
        out.staffPending = staff.filter((s: any) => {
          const inactive = s.active === false || s.active === 0 || s.active === '0';
          const pending =
            String(s.status || '').toLowerCase() === 'pending' ||
            String(s.passwordHash || s.password_hash || '').includes('pending');
          return inactive || pending;
        }).length;
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }

  return NextResponse.json(out);
}
