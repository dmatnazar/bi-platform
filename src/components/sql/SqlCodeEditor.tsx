'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    CodeMirror?: any;
  }
}

const CM_CSS = [
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/material-darker.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/show-hint.min.css',
];

const CM_JS = [
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/sql/sql.min.js',
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

interface Props {
  value: string;
  onChange: (val: string) => void;
  height?: string;
  autoFocus?: boolean;
}

export function SqlCodeEditor({ value, onChange, height = '100%', autoFocus }: Props) {
  const hostRef = useRef<HTMLTextAreaElement>(null);
  const cmRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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
      hintOptions: { tables: {} },
    });
    cm.setValue(value || '');
    cm.on('change', (instance: any) => {
      onChangeRef.current(instance.getValue());
    });
    cmRef.current = cm;
    // size
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

  if (failed) {
    return (
      <textarea
        className="w-full h-full min-h-[200px] resize-none bg-slate-950 px-3 py-2 text-xs font-mono text-emerald-300 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    );
  }

  return (
    <div className="h-full w-full min-h-[200px] [&_.CodeMirror]:h-full [&_.CodeMirror]:text-[13px] [&_.CodeMirror-scroll]:min-h-[200px]">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 bg-slate-950/80 z-10">
          SQL redaktor ýüklenýär…
        </div>
      )}
      <textarea ref={hostRef} defaultValue={value} />
    </div>
  );
}
