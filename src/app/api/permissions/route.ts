import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/db';
import {
  PERMISSION_DEFS,
  DEFAULT_ROLE_PERMISSIONS,
  getEffectiveMatrix,
  sanitizeMatrixInput,
  setPermissionOverrides,
  permissionGroups,
  permissionsForRole,
  userHasPermission,
  type RolePermissionMatrix,
} from '@/lib/permissions';

/** GET — matrix + defs (full for super; effective self for others) */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Rugsat ýok' }, { status: 401 });
  }

  await getSettings();

  if (isSuperAdmin(user) || userHasPermission(user, 'manage_permissions')) {
    return NextResponse.json({
      defs: PERMISSION_DEFS,
      groups: permissionGroups(),
      matrix: getEffectiveMatrix(),
      defaults: DEFAULT_ROLE_PERMISSIONS,
      editableRoles: ['admin', 'editor', 'viewer'] as const,
    });
  }

  return NextResponse.json({
    self: permissionsForRole(user.role),
    role: user.role,
  });
}

/** PUT — save matrix (super_admin only) */
export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json(
      { error: 'Diňe super admin rugsatlary üýtgedip bilýär' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON nädogry' }, { status: 400 });
  }

  const rawMatrix = (body as { matrix?: unknown })?.matrix ?? body;
  const matrix = sanitizeMatrixInput(rawMatrix) as RolePermissionMatrix;

  await updateSettings({ rolePermissions: matrix as any });
  setPermissionOverrides(matrix);

  return NextResponse.json({
    ok: true,
    matrix: getEffectiveMatrix(),
  });
}

/** POST action=reset — restore factory defaults */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Diňe super admin' }, { status: 403 });
  }

  let action = 'reset';
  try {
    const body = await req.json();
    if (body?.action) action = String(body.action);
  } catch {
    /* empty body = reset */
  }

  if (action === 'reset') {
    await updateSettings({ rolePermissions: DEFAULT_ROLE_PERMISSIONS as any });
    setPermissionOverrides(DEFAULT_ROLE_PERMISSIONS);
    return NextResponse.json({ ok: true, matrix: getEffectiveMatrix(), reset: true });
  }

  return NextResponse.json({ error: 'Näbelli amal' }, { status: 400 });
}
