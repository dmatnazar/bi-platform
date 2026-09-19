import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'data', 'api-test-defaults.json');

type Store = Record<string, Record<string, string | number | boolean>>;

function readStore(): Store {
  try {
    if (!fs.existsSync(FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('api-test-defaults write', e);
  }
}

function keyOf(endpointId?: string, tenantSlug?: string, pathTemplate?: string) {
  if (endpointId) return `id:${endpointId}`;
  return `path:${tenantSlug || ''}::${pathTemplate || ''}`;
}

export function saveApiTestDefaults(
  endpointId: string | undefined,
  tenantSlug: string | undefined,
  pathTemplate: string | undefined,
  values: Record<string, string | number | boolean>
) {
  const s = readStore();
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (v === '' || v == null) continue;
    clean[k] = v;
  }
  const k1 = keyOf(endpointId, tenantSlug, pathTemplate);
  s[k1] = clean;
  if (endpointId && tenantSlug && pathTemplate) {
    s[keyOf(undefined, tenantSlug, pathTemplate)] = clean;
  }
  writeStore(s);
}

export function getApiTestDefaults(
  endpointId?: string,
  tenantSlug?: string,
  pathTemplate?: string
): Record<string, string | number | boolean> {
  const s = readStore();
  if (endpointId && s[`id:${endpointId}`]) return { ...s[`id:${endpointId}`] };
  const k = keyOf(undefined, tenantSlug, pathTemplate);
  return s[k] ? { ...s[k] } : {};
}

export function mergeTestDefaultsIntoEndpoints<T extends Record<string, any>>(endpoints: T[]): T[] {
  return (endpoints || []).map((e) => {
    const td = getApiTestDefaults(e.id, e.tenantSlug, e.pathTemplate);
    if (!Object.keys(td).length && !(e as any).testDefaults) return e;
    return {
      ...e,
      testDefaults: { ...td, ...((e as any).testDefaults || {}) },
    };
  });
}
