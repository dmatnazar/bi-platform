'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

declare global {
  interface Window {
    CodeMirror?: any;
  }
}

const CM_CSS = [
  '/vendor/codemirror/codemirror.min.css',
  '/vendor/codemirror/material-darker.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/show-hint.min.css',
];

const CM_JS = [
  '/vendor/codemirror/codemirror.min.js',
  '/vendor/codemirror/sql.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/show-hint.min.js',
];

/** Navicat-like SQL keywords (upper-case insert) */
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
  'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON',
  'GROUP BY', 'ORDER BY', 'HAVING', 'ASC', 'DESC', 'TOP', 'DISTINCT', 'AS', 'WITH',
  'UNION', 'UNION ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IS', 'NULL',
  'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'ISNULL', 'CAST', 'CONVERT',
  'GETDATE', 'DATEADD', 'DATEDIFF', 'YEAR', 'MONTH', 'DAY',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', // shown but blocked on run by safety
];

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** One-time Navicat-ish hint list styling */
function ensureHintStyles() {
  if (document.getElementById('bi-sql-hint-style')) return;
  const st = document.createElement('style');
  st.id = 'bi-sql-hint-style';
  st.textContent = `
    .CodeMirror-hints {
      z-index: 2147483000 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      max-height: 280px;
      min-width: 220px;
      border: 1px solid #334155 !important;
      background: #0f172a !important;
      border-radius: 8px;
      box-shadow: 0 12px 40px rgba(0,0,0,.55);
      padding: 4px 0;
    }
    .CodeMirror-hint {
      color: #e2e8f0 !important;
      padding: 4px 10px !important;
      line-height: 1.35;
    }
    .CodeMirror-hint-active {
      background: #4f46e5 !important;
      color: #fff !important;
    }
    .bi-hint-kw { color: #c4b5fd; }
    .bi-hint-tbl { color: #6ee7b7; }
    .bi-hint-col { color: #93c5fd; }
    .CodeMirror-hint-active .bi-hint-kw,
    .CodeMirror-hint-active .bi-hint-tbl,
    .CodeMirror-hint-active .bi-hint-col { color: #fff; }
    .bi-hint-meta {
      float: right;
      margin-left: 12px;
      opacity: 0.55;
      font-size: 10px;
    }
  `;
  document.head.appendChild(st);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      // Already fully loaded
      if ((existing as any).dataset.loaded === '1') {
        resolve();
        return;
      }
      // In-flight: wait for same tag
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true }
      );
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => {
      (s as any).dataset.loaded = '1';
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let loadPromise: Promise<void> | null = null;

function ensureCodeMirror(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  // Need both core + showHint addon
  if (window.CodeMirror && typeof window.CodeMirror.prototype.showHint === 'function') {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    CM_CSS.forEach(loadCss);
    ensureHintStyles();
    for (const src of CM_JS) {
      await loadScript(src);
    }
    if (!window.CodeMirror || typeof window.CodeMirror.prototype.showHint !== 'function') {
      loadPromise = null;
      throw new Error('CodeMirror show-hint ýüklenmedi (CDN / vendor)');
    }
  })().catch((e) => {
    loadPromise = null;
    throw e;
  });

  return loadPromise;
}


export type SqlCodeEditorHandle = {
  getSelectedOrFull: () => string;
  getSelection: () => string;
  getValue: () => string;
  focus: () => void;
};

interface Props {
  value: string;
  onChange: (val: string) => void;
  height?: string;
  autoFocus?: boolean;
  /** { tableOrAlias: string[] columns } */
  hintTables?: Record<string, string[]>;
  /** Flat list of table names (for LIKE search) */
  tableNames?: string[];
  onNeedTableColumns?: (tableOrAlias: string) => void;
}

type HintKind = 'keyword' | 'table' | 'column';

function likeMatch(candidate: string, q: string): boolean {
  if (!q) return true;
  return candidate.toLowerCase().includes(q.toLowerCase());
}

function rankMatch(candidate: string, q: string): number {
  if (!q) return 0;
  const c = candidate.toLowerCase();
  const qq = q.toLowerCase();
  if (c === qq) return 0;
  if (c.startsWith(qq)) return 1;
  if (c.includes(`.${qq}`)) return 2;
  const idx = c.indexOf(qq);
  if (idx > 0) return 3 + idx;
  return 100;
}

function makeHintItem(CM: any, text: string, kind: HintKind, meta?: string) {
  return {
    text,
    displayText: text,
    className:
      kind === 'keyword' ? 'bi-hint-kw' : kind === 'table' ? 'bi-hint-tbl' : 'bi-hint-col',
    render: (el: HTMLElement, _self: unknown, data: { text: string }) => {
      const span = document.createElement('span');
      span.className =
        kind === 'keyword' ? 'bi-hint-kw' : kind === 'table' ? 'bi-hint-tbl' : 'bi-hint-col';
      span.textContent = data.text;
      el.appendChild(span);
      if (meta) {
        const m = document.createElement('span');
        m.className = 'bi-hint-meta';
        m.textContent = meta;
        el.appendChild(m);
      }
    },
  };
}

function buildSmartHint(CM: any, cm: any, opts: {
  tables: Record<string, string[]>;
  tableNames: string[];
  onNeed?: (name: string) => void;
}) {
  const cur = cm.getCursor();
  const line = cm.getLine(cur.line) || '';
  const before = line.slice(0, cur.ch);
  // word being typed
  const wordMatch = before.match(/([A-Za-z_@#][\w@#$]*)$/);
  const word = wordMatch ? wordMatch[1] : '';
  const from = word
    ? CM.Pos(cur.line, cur.ch - word.length)
    : cur;
  const to = cur;

  // "alias." or "table." just before cursor (word may be empty after dot)
  const dotMatch = before.match(/([A-Za-z_][\w]*)\.\s*([A-Za-z_@#][\w@#$]*)?$/);
  const list: any[] = [];

  if (dotMatch) {
    const obj = dotMatch[1];
    const partial = dotMatch[2] || '';
    opts.onNeed?.(obj);
    const cols =
      opts.tables[obj] ||
      opts.tables[obj.toLowerCase()] ||
      [];
    // also try case-insensitive key search
    let colList = cols;
    if (!colList.length) {
      const k = Object.keys(opts.tables).find((x) => x.toLowerCase() === obj.toLowerCase());
      if (k) colList = opts.tables[k] || [];
    }
    for (const c of colList) {
      if (likeMatch(c, partial)) {
        list.push(makeHintItem(CM, c, 'column', 'col'));
      }
    }
    list.sort((a, b) => rankMatch(a.text, partial) - rankMatch(b.text, partial));
    return { list: list.slice(0, 80), from: partial ? CM.Pos(cur.line, cur.ch - partial.length) : cur, to };
  }

  // After FROM / JOIN → prefer tables (LIKE)
  const afterFrom = /\b(FROM|JOIN)\s+([A-Za-z_@#][\w@#$.]*)?$/i.test(before);
  // After SELECT / comma / SET-like list → columns + keywords
  const afterSelect =
    /\bSELECT\s+(?:TOP\s+\d+\s+)?(?:DISTINCT\s+)?([\w\s,.*]*)$/i.test(before) ||
    /,\s*([A-Za-z_@#][\w@#$]*)?$/i.test(before);

  if (afterFrom) {
    const names = opts.tableNames.length
      ? opts.tableNames
      : Object.keys(opts.tables);
    for (const t of names) {
      if (likeMatch(t, word)) {
        list.push(makeHintItem(CM, t, 'table', 'table'));
      }
    }
    list.sort((a, b) => rankMatch(a.text, word) - rankMatch(b.text, word));
    // also schema.table short names already in list
    return { list: list.slice(0, 100), from, to };
  }

  // Keywords first when matching (se → SELECT, fr → FROM)
  for (const kw of SQL_KEYWORDS) {
    if (likeMatch(kw, word) && (word.length === 0 || kw.toLowerCase().startsWith(word.toLowerCase()) || likeMatch(kw.replace(/\s+/g, ''), word))) {
      // Prefer prefix for keywords
      if (!word || kw.toLowerCase().startsWith(word.toLowerCase()) || kw.toLowerCase().includes(word.toLowerCase())) {
        list.push(makeHintItem(CM, kw, 'keyword', 'SQL'));
      }
    }
  }

  // Tables (LIKE anywhere)
  const names = opts.tableNames.length ? opts.tableNames : Object.keys(opts.tables);
  for (const t of names) {
    if (likeMatch(t, word)) list.push(makeHintItem(CM, t, 'table', 'table'));
  }

  // Columns from all known tables (when writing select list)
  if (afterSelect || word.length >= 1) {
    const seen = new Set<string>();
    for (const cols of Object.values(opts.tables)) {
      for (const c of cols || []) {
        if (seen.has(c.toLowerCase())) continue;
        if (likeMatch(c, word)) {
          seen.add(c.toLowerCase());
          list.push(makeHintItem(CM, c, 'column', 'col'));
        }
      }
    }
  }

  // Dedupe by text, keep first kind priority keyword > table > column already ordered loosely
  const dedup: any[] = [];
  const seenText = new Set<string>();
  for (const item of list) {
    const k = item.text.toLowerCase();
    if (seenText.has(k)) continue;
    seenText.add(k);
    dedup.push(item);
  }
  dedup.sort((a, b) => rankMatch(a.text, word) - rankMatch(b.text, word) || a.text.localeCompare(b.text));
  return { list: dedup.slice(0, 120), from, to };
}

export const SqlCodeEditor = forwardRef<SqlCodeEditorHandle, Props>(
  function SqlCodeEditor(
    {
      value,
      onChange,
      height = '100%',
      autoFocus,
      hintTables,
      tableNames,
      onNeedTableColumns,
    },
    ref
  ) {
    const hostRef = useRef<HTMLTextAreaElement>(null);
    const cmRef = useRef<any>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onNeedRef = useRef(onNeedTableColumns);
    onNeedRef.current = onNeedTableColumns;
    const hintTablesRef = useRef(hintTables || {});
    hintTablesRef.current = hintTables || {};
    const tableNamesRef = useRef(tableNames || []);
    tableNamesRef.current = tableNames || [];
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useImperativeHandle(ref, () => ({
      getSelection: () => {
        const cm = cmRef.current;
        if (cm) return String(cm.getSelection() || '');
        const ta = hostRef.current;
        if (ta && typeof ta.selectionStart === 'number') {
          return (ta.value || '').slice(ta.selectionStart, ta.selectionEnd);
        }
        return '';
      },
      getSelectedOrFull: () => {
        const cm = cmRef.current;
        if (cm) {
          const sel = String(cm.getSelection() || '').trim();
          if (sel) return sel;
          return String(cm.getValue() || '');
        }
        const ta = hostRef.current;
        if (ta) {
          const sel = (ta.value || '').slice(ta.selectionStart, ta.selectionEnd).trim();
          if (sel) return sel;
          return ta.value || '';
        }
        return value || '';
      },
      getValue: () => {
        const cm = cmRef.current;
        if (cm) return String(cm.getValue() || '');
        return hostRef.current?.value ?? value ?? '';
      },
      focus: () => {
        cmRef.current?.focus?.();
        hostRef.current?.focus?.();
      },
    }));

    useEffect(() => {
      let cancelled = false;
      ensureCodeMirror()
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (!ready || !hostRef.current || cmRef.current || !window.CodeMirror) return;
      const CM = window.CodeMirror;
      ensureHintStyles();

      function triggerHint(instance: any) {
        try {
          if (typeof instance.showHint !== 'function') return;
          instance.showHint({
            completeSingle: false,
            // body: overflow:hidden parent-lar hint klikini bozmaz ýaly
            container: typeof document !== 'undefined' ? document.body : undefined,
            closeOnUnfocus: true,
            alignWithWord: true,
            hint: (cm: any) =>
              buildSmartHint(CM, cm, {
                tables: hintTablesRef.current,
                tableNames: tableNamesRef.current,
                onNeed: (n) => onNeedRef.current?.(n),
              }),
          });
        } catch {
          /* */
        }
      }

      const cm = CM.fromTextArea(hostRef.current, {
        mode: 'text/x-mssql',
        theme: 'material-darker',
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
        matchBrackets: true,
        autofocus: !!autoFocus,
        extraKeys: {
          'Ctrl-Space': (cm: any) => triggerHint(cm),
          'Cmd-Space': (cm: any) => triggerHint(cm),
        },
      });
      cm.setValue(value || '');
      cm.on('change', (instance: any, change: any) => {
        onChangeRef.current(instance.getValue());
        // After finishing a token with space — try load columns for previous word if FROM context
        if (change && change.origin === '+input' && change.text && change.text[0] === ' ') {
          try {
            const cur = instance.getCursor();
            const line = instance.getLine(cur.line) || '';
            const before = line.slice(0, cur.ch);
            const m = before.match(
              /\b(?:FROM|JOIN)\s+(?:\[?\w+\]?\.)?\[?(\w+)\]?\s+$/i
            );
            if (m) onNeedRef.current?.(m[1]);
          } catch {
            /* */
          }
        }
      });

      cm.on('inputRead', (instance: any, change: any) => {
        if (!change || change.origin !== '+input') return;
        const text = (change.text && change.text[0]) || '';
        if (!text) return;
        if (text === '.' || /[A-Za-z_@]/.test(text)) {
          if (text === '.') {
            try {
              const cur = instance.getCursor();
              const line = instance.getLine(cur.line) || '';
              const before = line.slice(0, cur.ch - 1);
              const m = before.match(/([A-Za-z_][\w]*)$/);
              if (m) onNeedRef.current?.(m[1]);
            } catch {
              /* */
            }
          }
          triggerHint(instance);
        }
      });

      cmRef.current = cm;
      const wrapper = cm.getWrapperElement();
      if (wrapper) {
        wrapper.style.height = height === '100%' ? '100%' : height;
        wrapper.style.fontSize = '13px';
      }
      cm.refresh();
      return () => {
        try {
          cm.toTextArea();
        } catch {
          /* */
        }
        cmRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    useEffect(() => {
      const cm = cmRef.current;
      if (!cm) return;
      if (cm.getValue() !== value) {
        const cursor = cm.getCursor();
        cm.setValue(value || '');
        try {
          cm.setCursor(cursor);
        } catch {
          /* */
        }
      }
    }, [value]);

    useEffect(() => {
      hintTablesRef.current = hintTables || {};
      tableNamesRef.current = tableNames || [];
    }, [hintTables, tableNames]);

    if (failed) {
      return (
        <textarea
          ref={hostRef}
          className="w-full h-full min-h-[200px] resize-none bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-300 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      );
    }

    return (
      <div className="h-full w-full min-h-[200px] relative [&_.CodeMirror]:h-full [&_.CodeMirror]:text-[13px] [&_.CodeMirror-scroll]:min-h-[200px]">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 bg-slate-950/80 z-10">
            SQL redaktor ýüklenýär…
          </div>
        )}
        <textarea ref={hostRef} defaultValue={value} />
      </div>
    );
  }
);

export function preloadSqlEditor() {
  return ensureCodeMirror().catch(() => {});
}

if (typeof window !== 'undefined') {
  void preloadSqlEditor();
}
