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
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/sql-hint.min.js',
];

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let loadPromise: Promise<void> | null = null;

function ensureCodeMirror(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.CodeMirror) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    CM_CSS.forEach(loadCss);
    for (const src of CM_JS) {
      await loadScript(src);
    }
  })();
  return loadPromise;
}

export type SqlCodeEditorHandle = {
  /** Selected text if any, else full value */
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
  /**
   * CodeMirror sql-hint tables map: { TableName: ['col1','col2'], alias: [...] }
   * Updated silently when schema cache loads — no UI spinner.
   */
  hintTables?: Record<string, string[]>;
  /** Optional: called when user types a likely table/alias so parent can fetch columns */
  onNeedTableColumns?: (tableOrAlias: string) => void;
}

export const SqlCodeEditor = forwardRef<SqlCodeEditorHandle, Props>(
  function SqlCodeEditor(
    { value, onChange, height = '100%', autoFocus, hintTables, onNeedTableColumns },
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
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const fallbackSelRef = useRef({ start: 0, end: 0 });

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
          'Ctrl-Space': 'autocomplete',
          'Cmd-Space': 'autocomplete',
        },
        hintOptions: {
          tables: hintTablesRef.current,
          completeSingle: false,
        },
      });
      cm.setValue(value || '');
      cm.on('change', (instance: any) => {
        onChangeRef.current(instance.getValue());
      });

      // Auto-suggest while typing letters or after "."
      cm.on('inputRead', (instance: any, change: any) => {
        if (!change || change.origin !== '+input') return;
        const text = (change.text && change.text[0]) || '';
        if (!text) return;
        if (text === '.' || /[A-Za-z_@]/.test(text)) {
          // Detect alias/table before dot for column fetch
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
          } else if (/[A-Za-z_]/.test(text)) {
            // After FROM/JOIN word start — parent may already have tables
            try {
              const cur = instance.getCursor();
              const line = instance.getLine(cur.line) || '';
              const before = line.slice(0, cur.ch);
              if (/\b(FROM|JOIN)\s+[A-Za-z_@]*$/i.test(before)) {
                // tables already in hintOptions
              }
            } catch {
              /* */
            }
          }
          try {
            CM.commands.autocomplete(instance, null, { completeSingle: false });
          } catch {
            /* */
          }
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

    // Sync external value
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

    // Update hint tables silently
    useEffect(() => {
      const cm = cmRef.current;
      if (!cm) return;
      const tables = hintTables || {};
      hintTablesRef.current = tables;
      try {
        cm.setOption('hintOptions', { tables, completeSingle: false });
      } catch {
        /* */
      }
    }, [hintTables]);

    if (failed) {
      return (
        <textarea
          ref={hostRef}
          className="w-full h-full min-h-[200px] resize-none bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-300 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={(e) => {
            const t = e.currentTarget;
            fallbackSelRef.current = { start: t.selectionStart, end: t.selectionEnd };
          }}
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

/** Warm CodeMirror CDN cache — safe to call many times */
export function preloadSqlEditor() {
  return ensureCodeMirror().catch(() => {});
}

if (typeof window !== 'undefined') {
  void preloadSqlEditor();
}
