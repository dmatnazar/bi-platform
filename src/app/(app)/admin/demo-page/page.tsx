'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLocale } from '@/components/LocaleProvider';
import type { DemoPageContent, DemoPartner, DemoBannerSlide, DemoCapability, LocalizedText } from '@/lib/demo-page-store';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { MediaUrlField } from '@/components/demo/MediaUrlField';
import { cn } from '@/lib/utils';

function emptyLoc(): LocalizedText {
  return { tm: '', ru: '' };
}

function LocFields({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  rows?: number;
}) {
  const cls =
    'w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/40';
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows <= 1 ? (
          <>
            <Input label="TM" value={value?.tm || ''} onChange={(e) => onChange({ ...value, tm: e.target.value })} />
            <Input label="RU" value={value?.ru || ''} onChange={(e) => onChange({ ...value, ru: e.target.value })} />
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">TM</label>
              <textarea rows={rows} className={cls} value={value?.tm || ''} onChange={(e) => onChange({ ...value, tm: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">RU</label>
              <textarea rows={rows} className={cls} value={value?.ru || ''} onChange={(e) => onChange({ ...value, ru: e.target.value })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminDemoPage() {
  const { t } = useLocale();
  const [content, setContent] = useState<DemoPageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'texts' | 'partners' | 'banners' | 'capabilities'>('texts');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/demo-page');
      const data = await res.json();
      if (res.ok) setContent(data);
      else setMsg(data.error || 'Ýüklenmedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!content) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/demo-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      const data = await res.json();
      if (res.ok) {
        setContent(data);
        setMsg(t('saved') || 'Saklandy');
      } else setMsg(data.error || 'Saklanmady');
    } finally {
      setSaving(false);
    }
  }

  function patch(p: Partial<DemoPageContent>) {
    setContent((c) => (c ? { ...c, ...p } : c));
  }

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  const tabs = [
    { id: 'texts' as const, label: t('texts') || 'Tekstler' },
    { id: 'capabilities' as const, label: t('capabilities') || 'Mümkinçilikler' },
    { id: 'partners' as const, label: t('partners') || 'Firmalar' },
    { id: 'banners' as const, label: 'Banner' },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{t('navDemoPage') || 'Demo Page'}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Info / Demo sahypa tekstleri, banner we hyzmatdaş firmalar (TM + RU). JSON: data/demo-page.json
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/demo" target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:underline px-2">
            /demo
          </a>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {t('save')}
          </Button>
        </div>
      </div>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium',
              tab === x.id ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-400 hover:text-white'
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'texts' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <LocFields label="Brand title" value={content.brandTitle} onChange={(v) => patch({ brandTitle: v })} />
          <LocFields label="Brand subtitle" value={content.brandSubtitle} onChange={(v) => patch({ brandSubtitle: v })} />
          <LocFields label="Hero badge" value={content.heroBadge} onChange={(v) => patch({ heroBadge: v })} />
          <LocFields label="Hero title" value={content.heroTitle} onChange={(v) => patch({ heroTitle: v })} rows={2} />
          <LocFields label="Hero text" value={content.heroText} onChange={(v) => patch({ heroText: v })} rows={3} />
          <LocFields label="Dashboard title" value={content.dashboardTitle} onChange={(v) => patch({ dashboardTitle: v })} />
          <LocFields label="Dashboard subtitle" value={content.dashboardSubtitle} onChange={(v) => patch({ dashboardSubtitle: v })} rows={2} />
          <LocFields label="About title" value={content.aboutTitle} onChange={(v) => patch({ aboutTitle: v })} />
          <LocFields label="About text 1" value={content.aboutText1} onChange={(v) => patch({ aboutText1: v })} rows={3} />
          <LocFields label="About text 2" value={content.aboutText2} onChange={(v) => patch({ aboutText2: v })} rows={3} />
          <LocFields label="Partners title" value={content.partnersTitle} onChange={(v) => patch({ partnersTitle: v })} />
          <LocFields label="Partners subtitle" value={content.partnersSubtitle} onChange={(v) => patch({ partnersSubtitle: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Email" value={content.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} />
            <Input label="Phone" value={content.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} />
          </div>
          <Input
            label="Banner interval (ms)"
            type="number"
            value={String(content.bannerIntervalMs || 5000)}
            onChange={(e) => patch({ bannerIntervalMs: Number(e.target.value) || 5000 })}
          />
        </div>
      )}

      {tab === 'capabilities' && (
        <div className="space-y-3">
          {(content.capabilities || []).map((c, i) => (
            <div key={c.id} className="rounded-xl border border-slate-800 p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">#{i + 1}</span>
                <button
                  type="button"
                  className="text-rose-400 text-xs"
                  onClick={() =>
                    patch({ capabilities: content.capabilities.filter((x) => x.id !== c.id) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <LocFields
                label="Title"
                value={c.title}
                onChange={(v) => {
                  const next = [...content.capabilities];
                  next[i] = { ...c, title: v };
                  patch({ capabilities: next });
                }}
              />
              <LocFields
                label="Text"
                value={c.text}
                rows={2}
                onChange={(v) => {
                  const next = [...content.capabilities];
                  next[i] = { ...c, text: v };
                  patch({ capabilities: next });
                }}
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const item: DemoCapability = {
                id: `cap-${Date.now()}`,
                title: emptyLoc(),
                text: emptyLoc(),
                order: content.capabilities.length,
                active: true,
              };
              patch({ capabilities: [...content.capabilities, item] });
            }}
          >
            <Plus className="h-4 w-4" /> Goş
          </Button>
        </div>
      )}

      {tab === 'partners' && (
        <div className="space-y-3">
          {(content.partners || []).map((p, i) => (
            <div key={p.id} className="rounded-xl border border-slate-800 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={(e) => {
                      const next = [...content.partners];
                      next[i] = { ...p, active: e.target.checked };
                      patch({ partners: next });
                    }}
                  />
                  Active
                </label>
                <button
                  type="button"
                  className="text-rose-400"
                  onClick={() => patch({ partners: content.partners.filter((x) => x.id !== p.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  label="Ady (TM)"
                  value={p.name}
                  onChange={(e) => {
                    const next = [...content.partners];
                    next[i] = { ...p, name: e.target.value };
                    patch({ partners: next });
                  }}
                />
                <Input
                  label="Ady (RU)"
                  value={p.nameRu || ''}
                  onChange={(e) => {
                    const next = [...content.partners];
                    next[i] = { ...p, nameRu: e.target.value };
                    patch({ partners: next });
                  }}
                />
              </div>
              <MediaUrlField
                label="Icon (URL ýa-da ýükle)"
                value={p.iconUrl || ''}
                onChange={(url) => {
                  const next = [...content.partners];
                  next[i] = { ...p, iconUrl: url };
                  patch({ partners: next });
                }}
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const item: DemoPartner = {
                id: `pt-${Date.now()}`,
                name: '',
                nameRu: '',
                iconUrl: '',
                order: content.partners.length,
                active: true,
              };
              patch({ partners: [...content.partners, item] });
            }}
          >
            <Plus className="h-4 w-4" /> Firma goş
          </Button>
        </div>
      )}

      {tab === 'banners' && (
        <div className="space-y-3">
          {(content.banners || []).map((b, i) => (
            <div key={b.id} className="rounded-xl border border-slate-800 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={b.active}
                    onChange={(e) => {
                      const next = [...content.banners];
                      next[i] = { ...b, active: e.target.checked };
                      patch({ banners: next });
                    }}
                  />
                  Active
                </label>
                <button
                  type="button"
                  className="text-rose-400"
                  onClick={() => patch({ banners: content.banners.filter((x) => x.id !== b.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <LocFields
                label="Title"
                value={b.title}
                onChange={(v) => {
                  const next = [...content.banners];
                  next[i] = { ...b, title: v };
                  patch({ banners: next });
                }}
              />
              <LocFields
                label="Subtitle"
                value={b.subtitle || emptyLoc()}
                onChange={(v) => {
                  const next = [...content.banners];
                  next[i] = { ...b, subtitle: v };
                  patch({ banners: next });
                }}
              />
              <MediaUrlField
                label="Banner surat (URL ýa-da ýükle, GIF mümkin)"
                value={b.imageUrl || ''}
                onChange={(url) => {
                  const next = [...content.banners];
                  next[i] = { ...b, imageUrl: url };
                  patch({ banners: next });
                }}
              />
              <Input
                label="Link URL"
                value={b.linkUrl || ''}
                onChange={(e) => {
                  const next = [...content.banners];
                  next[i] = { ...b, linkUrl: e.target.value };
                  patch({ banners: next });
                }}
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const item: DemoBannerSlide = {
                id: `bn-${Date.now()}`,
                title: emptyLoc(),
                subtitle: emptyLoc(),
                imageUrl: '',
                linkUrl: '',
                order: content.banners.length,
                active: true,
              };
              patch({ banners: [...content.banners, item] });
            }}
          >
            <Plus className="h-4 w-4" /> Banner goş
          </Button>
        </div>
      )}
    </div>
  );
}
