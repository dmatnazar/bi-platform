/**
 * Strict read-only SQL guard for BI endpoints / test-query.
 * Blocks any statement that can mutate or control the database.
 */
export type SqlSafetyResult = { ok: true } | { ok: false; reason: string };

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|GRANT|REVOKE|BACKUP|RESTORE|SHUTDOWN|INTO\s+OUTFILE|BULK\s+INSERT|OPENROWSET|OPENDATASOURCE|XP_|SP_CONFIGURE|SP_OACREATE|SP_OA)\b/i;

/** SET assignments (not SET NOCOUNT / SET ANSI_* session options) */
const FORBIDDEN_SET =
  /\bSET\s+(?!NOCOUNT\b|QUOTED_IDENTIFIER\b|ANSI_\w+\b|TRANSACTION\b|XACT_ABORT\b|IDENTITY_INSERT\b|DATEFORMAT\b|LANGUAGE\b)/i;

function stripSqlNoise(sql: string): string {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\s+/g, ' ')
    .trim();
}

export function assertReadOnlySql(sql: string): SqlSafetyResult {
  const stripped = stripSqlNoise(sql);
  if (!stripped) return { ok: false, reason: 'SQL boş' };

  if (FORBIDDEN.test(stripped) || FORBIDDEN_SET.test(stripped)) {
    return {
      ok: false,
      reason:
        'Howpsuzlyk: diňe SELECT (okamak) rugsat. INSERT / UPDATE / DELETE / SET / DROP we beýleki üýtgediji SQL gadagan.',
    };
  }

  // Must be SELECT or CTE → SELECT
  if (!/^\s*(WITH|SELECT)\b/i.test(stripped)) {
    return {
      ok: false,
      reason: 'SQL SELECT ýa-da WITH ... SELECT bilen başlamaly (diňe okamak).',
    };
  }

  return { ok: true };
}
