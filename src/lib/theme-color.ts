/**
 * Theme-aware color values for widget config.
 * - string: same color in both themes (legacy / simple)
 * - { dark, light }: independent colors per theme
 */
export type ThemeMode = 'dark' | 'light';

export type ThemeColor = string | { dark?: string; light?: string };

export function isThemeColorObject(
  v: unknown
): v is { dark?: string; light?: string } {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Resolve a stored ThemeColor to a concrete CSS color for the active theme. */
export function resolveThemeColor(
  value: ThemeColor | undefined | null,
  theme: ThemeMode,
  fallback: string
): string {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') return value;
  const preferred = theme === 'light' ? value.light : value.dark;
  const other = theme === 'light' ? value.dark : value.light;
  return preferred || other || fallback;
}

/** Resolve each entry in a palette (supports mixed string / ThemeColor). */
export function resolveThemeColorList(
  list: Array<ThemeColor | string> | readonly ThemeColor[] | undefined | null,
  theme: ThemeMode,
  fallbacks: readonly string[]
): string[] {
  if (!list || list.length === 0) return [...fallbacks];
  return list.map((c, i) =>
    resolveThemeColor(c as ThemeColor, theme, fallbacks[i % fallbacks.length] || '#6366f1')
  );
}

/**
 * Update one theme slot. Converts legacy string into { dark, light }.
 * When first setting the other theme, copies the existing string so dark stays stable.
 */
export function setThemeColorSlot(
  current: ThemeColor | undefined,
  theme: ThemeMode,
  hex: string
): ThemeColor {
  const asObj = isThemeColorObject(current)
    ? { dark: current.dark, light: current.light }
    : typeof current === 'string' && current
      ? { dark: current, light: current }
      : { dark: undefined as string | undefined, light: undefined as string | undefined };

  if (theme === 'dark') asObj.dark = hex;
  else asObj.light = hex;

  // If only one side set, keep compact string only when both equal
  if (asObj.dark && asObj.light && asObj.dark === asObj.light) {
    return asObj.dark;
  }
  return asObj;
}

/** Hex string for <input type="color"> (must be #rrggbb). */
export function themeColorInputValue(
  value: ThemeColor | undefined,
  theme: ThemeMode,
  fallback: string
): string {
  const raw = resolveThemeColor(value, theme, fallback);
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1],
      g = raw[2],
      b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

/** Default chart/KPI colors that adapt to theme when user has not set a custom color. */
export const THEME_DEFAULTS = {
  primary: { dark: '#6366f1', light: '#4f46e5' },
  kpiText: { dark: '#ffffff', light: '#0f172a' },
  label: { dark: '#94a3b8', light: '#475569' },
  axisLabel: { dark: '#94a3b8', light: '#64748b' },
  palette: {
    dark: ['#6366f1', '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa'],
    light: ['#4f46e5', '#0891b2', '#7c3aed', '#db2777', '#d97706', '#059669', '#e11d48', '#2563eb'],
  },
  chartLabelInside: { dark: '#f1f5f9', light: '#0f172a' },
  chartLabelOutside: { dark: '#e2e8f0', light: '#334155' },
  legend: { dark: '#94a3b8', light: '#64748b' },
  gridLine: { dark: '#1e293b', light: '#e2e8f0' },
  axisLine: { dark: '#334155', light: '#cbd5e1' },
  labelBg: { dark: 'rgba(15, 23, 42, 0.92)', light: 'rgba(255, 255, 255, 0.92)' },
  pieBorder: { dark: '#0f172a', light: '#f8fafc' },
  pieBorderActive: { dark: '#ffffff', light: '#0f172a' },
  pieLabelLine: { dark: '#64748b', light: '#94a3b8' },
} as const;
