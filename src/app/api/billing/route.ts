import { NextRequest, NextResponse } from 'next/server';
import { getSession, canManageCompany } from '@/lib/auth';
import {
  checkGatewayHealth,
  billingOverviewOnGateway,
  upsertTariffOnGateway,
  assignTariffOnGateway,
  topUpOnGateway,
  adjustBalanceOnGateway,
  ledgerOnGateway,
  walletOnGateway,
  listTariffsOnGateway,
  requestTariffChangeOnGateway,
  listTariffRequestsOnGateway,
  resolveTariffRequestOnGateway,
} from '@/lib/gateway';

function isSuper(user: any) {
  return !!(user?.isSuperAdmin || user?.role === 'super_admin' || user?.role === 'superadmin');
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'overview';

  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }

  // Public: tariff list for registration / marketing
  if (action === 'tariffs') {
    const res = await listTariffsOnGateway();
    if (!res.ok) return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
    return NextResponse.json(res.data);
  }

  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });

  const tenantSlug =
    req.nextUrl.searchParams.get('tenantSlug') || user.companySlug || '';

  // Any authenticated user can read own company wallet + tariffs (for profile badge)
  if (action === 'my-wallet' || action === 'wallet') {
    const slug = action === 'my-wallet' ? user.companySlug || '' : tenantSlug;
    if (!slug) return NextResponse.json({ error: 'companySlug ýok' }, { status: 400 });
    if (!isSuper(user) && user.companySlug && slug !== user.companySlug) {
      return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
    }
    const [wRes, tRes] = await Promise.all([
      walletOnGateway(slug),
      listTariffsOnGateway(),
    ]);
    if (!wRes.ok) {
      return NextResponse.json({ error: wRes.data?.error || 'şowsuz' }, { status: 502 });
    }
    return NextResponse.json({
      ...wRes.data,
      tariffs: tRes.ok ? tRes.data?.tariffs || [] : [],
    });
  }

  // Admin-only below
  if (!canManageCompany(user.role) && !isSuper(user)) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
  }

  if (action === 'ledger') {
    if (!isSuper(user)) return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
    const res = await ledgerOnGateway({
      tenantSlug: tenantSlug || undefined,
      limit: Number(req.nextUrl.searchParams.get('limit') || 50),
    });
    if (!res.ok) return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
    return NextResponse.json(res.data);
  }

  if (action === 'tariff-requests') {
    if (!isSuper(user)) return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
    const res = await listTariffRequestsOnGateway(
      req.nextUrl.searchParams.get('status') || undefined
    );
    if (!res.ok) return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
    return NextResponse.json(res.data);
  }

  if (!isSuper(user)) {
    return NextResponse.json({ error: 'Diňe super admin' }, { status: 403 });
  }

  const res = await billingOverviewOnGateway();
  if (!res.ok) return NextResponse.json({ error: res.data?.error || 'şowsuz' }, { status: 502 });
  return NextResponse.json(res.data);
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Giriş gerek' }, { status: 401 });
  if (!(await checkGatewayHealth())) {
    return NextResponse.json({ error: 'VPS offline' }, { status: 503 });
  }

  const body = await req.json();
  const action = body.action || req.nextUrl.searchParams.get('action');

  // Company users can request tariff change for their own firm
  if (action === 'request-tariff-change') {
    const slug = body.tenantSlug || user.companySlug;
    if (!slug) return NextResponse.json({ error: 'slug gerek' }, { status: 400 });
    if (!isSuper(user) && user.companySlug && slug !== user.companySlug) {
      return NextResponse.json({ error: 'Rugsat ýok' }, { status: 403 });
    }
    const res = await requestTariffChangeOnGateway({
      tenantSlug: slug,
      requestedTariffId: body.requestedTariffId,
      message: body.message,
      requestedBy: user.username || user.fullName || 'bi',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.data?.message || res.data?.error || 'şowsuz', detail: res.data },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }
    return NextResponse.json(res.data);
  }

  if (!isSuper(user)) {
    return NextResponse.json({ error: 'Diňe super admin' }, { status: 403 });
  }

  let res;
  if (action === 'tariff-upsert') {
    res = await upsertTariffOnGateway(body);
  } else if (action === 'assign-tariff') {
    res = await assignTariffOnGateway(body);
  } else if (action === 'topup') {
    res = await topUpOnGateway(body);
  } else if (action === 'adjust') {
    res = await adjustBalanceOnGateway(body);
  } else if (action === 'resolve-tariff-request') {
    res = await resolveTariffRequestOnGateway({
      requestId: body.requestId,
      action: body.resolveAction || body.decision,
      resolvedBy: user.username || 'admin',
    });
  } else {
    return NextResponse.json({ error: 'Näbelli action' }, { status: 400 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: res.data?.message || res.data?.error || 'şowsuz', detail: res.data },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }
  return NextResponse.json(res.data);
}
