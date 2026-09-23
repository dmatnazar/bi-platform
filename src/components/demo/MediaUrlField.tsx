'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
};

/** URL input + local file upload (PNG/JPG/WEBP/GIF) like news */
export function MediaUrlField({ label, value, onChange, accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml' }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function onFile(file: File | null) {
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/demo-page/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ýüklenmedi');
      onChange(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ýüklenmedi');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… ýa-da ýükle" />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800',
            uploading && 'opacity-60'
          )}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Kompýuterdan ýükle
        </button>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-10 w-10 rounded-lg object-cover border border-slate-700" />
        )}
      </div>
      {err && <p className="text-[11px] text-rose-400">{err}</p>}
      <p className="text-[10px] text-slate-500">PNG · JPG · WEBP · GIF · SVG (max 20MB)</p>
    </div>
  );
}
