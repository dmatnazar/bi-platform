'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function NewDashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Döretmek şowsuz');
        return;
      }
      router.push(`/dashboards/${data.dashboard.id}`);
    } catch {
      setError('Baglanyşyk säwligi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboards"
          className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-white">Täze dashboard</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4"
      >
        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
            {error}
          </div>
        )}
        <Input
          label="Ady"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mysal: Aýlyk satuw"
          required
        />
        <Input
          label="Düşündiriş (islege görä)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Gysga düşündiriş"
        />
        <Button type="submit" loading={loading} className="w-full">
          Döret we düz
        </Button>
      </form>
    </div>
  );
}
