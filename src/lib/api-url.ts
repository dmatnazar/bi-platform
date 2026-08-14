/**
 * Full public API URL matching Electron / VPS dynamic router:
 *   {base}/api/v1/{tenantSlug}/{dbKey}{pathTemplate}
 * e.g. http://localhost:4000/api/v1/h/primary/oreders
 */
export function buildFullApiUrl(opts: {
  gatewayBase: string;
  tenantSlug: string;
  pathTemplate: string;
  dbKey?: string;
}): string {
  const base = (opts.gatewayBase || '').replace(/\/$/, '');
  const slug = opts.tenantSlug || '';
  const dbKey = opts.dbKey || 'primary';
  let path = opts.pathTemplate || '';
  if (!path.startsWith('/')) path = '/' + path;
  return `${base}/api/v1/${slug}/${dbKey}${path}`;
}
