import React, { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, Activity, Zap, ArrowUpRight, Layers, ShieldCheck, Gauge } from "lucide-react";
import { Image } from "@/components/ui/image";

const HERO_IMG = "https://media.base44.com/images/public/6ab36fa07c9d039bb9d0ad32/96b6f6c63_generated_image.png";
const FEATURE_IMG = "https://media.base44.com/images/public/6ab36fa07c9d039bb9d0ad32/ba9bb3152_generated_image.png";
const ANALYTICS_IMG = "https://media.base44.com/images/public/6ab36fa07c9d039bb9d0ad32/e22c74203_generated_image.png";
const RIBBON_IMG = "https://media.base44.com/images/public/6ab36fa07c9d039bb9d0ad32/531b469fd_generated_image.png";

const kpis = [
  { label: "Aýlyk girde", value: "48,250", change: "+12.4%", icon: TrendingUp, tint: "from-emerald-300/30 to-emerald-200/10", ring: "ring-emerald-200/80", iconColor: "text-emerald-600" },
  { label: "Täze ulanyjylar", value: "1,842", change: "+8.1%", icon: Users, tint: "from-sky-300/30 to-sky-200/10", ring: "ring-sky-200/80", iconColor: "text-sky-600" },
  { label: "Aktiwlik", value: "94.3%", change: "+3.2%", icon: Activity, tint: "from-violet-300/30 to-violet-200/10", ring: "ring-violet-200/80", iconColor: "text-violet-600" },
  { label: "Tizlik", value: "1.2s", change: "-0.3s", icon: Zap, tint: "from-amber-300/30 to-amber-200/10", ring: "ring-amber-200/80", iconColor: "text-amber-600" },
];

const chartData = [
  { label: "Duş", value: 42 },
  { label: "Söw", value: 58 },
  { label: "Çar", value: 49 },
  { label: "Pen", value: 71 },
  { label: "Anna", value: 64 },
  { label: "Şen", value: 88 },
  { label: "Ýek", value: 76 },
];

const features = [
  { icon: Layers, title: "Modul düzümi", desc: "Her bölegi aýratyn özleşdirip bilýärsiň.", tint: "bg-indigo-50", iconColor: "text-indigo-600" },
  { icon: ShieldCheck, title: "Güwançli", desc: "Maglumatyň gizlin saklanylýar.", tint: "bg-emerald-50", iconColor: "text-emerald-600" },
  { icon: Gauge, title: "Çalt", desc: "Hemmesi nowaýy animasiýa bilen işleýär.", tint: "bg-amber-50", iconColor: "text-amber-600" },
];

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

export default function Demo() {
  const [active, setActive] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/75 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200/60">I</div>
            <span className="font-semibold tracking-tight text-slate-900">InteraWeb Demo</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#features" className="hidden sm:inline-flex h-9 px-4 items-center rounded-full text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Aýratynlyklar</a>
            <button className="h-9 px-4 inline-flex items-center rounded-full text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm">Başlamak</button>
          </div>
        </div>
      </header>

      {/* Hero — taller banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-violet-50/40 to-slate-50" />
        <div className="absolute top-10 -left-10 w-72 h-72 bg-violet-200/30 rounded-full blur-3xl" />
        <div className="absolute top-20 right-0 w-80 h-80 bg-sky-200/25 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold ring-1 ring-violet-200">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" /> Canly demo
              </span>
              <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
                Döwrebap <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">animasiýalar</span> bilen dashboard
              </h1>
              <p className="mt-5 text-slate-500 text-lg leading-relaxed max-w-md">
                Ýumşak geçişler, akylly reňk paýlary we interaktiw kartlar — hemmesi light temada arassa we oňaýly.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="h-12 px-7 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-violet-300/50 hover:shadow-violet-400/50 hover:-translate-y-0.5 transition-all">
                  Demony aç
                </button>
                <a href="#features" className="h-12 px-7 rounded-full inline-flex items-center text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:-translate-y-0.5 transition-all shadow-sm">
                  Giňişleý
                </a>
              </div>
            </motion.div>

            {/* Animated hero image */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="absolute -inset-6 bg-gradient-to-tr from-indigo-200/50 via-violet-200/40 to-fuchsia-200/40 blur-3xl rounded-full animate-pulse" />
              <motion.div
                animate={{ y: [0, -16, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-violet-300/40 ring-1 ring-white/70"
              >
                <Image src={HERO_IMG} alt="Animasiýa suraty" className="w-full h-full" fittingType="fill" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="relative max-w-6xl mx-auto px-5 -mt-10 pb-2 z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`p-5 rounded-2xl bg-white ring-1 ${k.ring} shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300`}
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${k.tint} flex items-center justify-center ring-1 ${k.ring}`}>
                <k.icon className={`w-5 h-5 ${k.iconColor}`} />
              </div>
              <p className="mt-4 text-sm text-slate-400 font-medium">{k.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{k.value}</p>
              <p className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold ${k.change.startsWith("-") ? "text-rose-500" : "text-emerald-600"}`}>
                <ArrowUpRight className={`w-3 h-3 ${k.change.startsWith("-") ? "rotate-90" : ""}`} />
                {k.change}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Analytics image + bar chart */}
      <section className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid md:grid-cols-5 gap-6">
          <motion.div
            {...reveal}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-2 relative rounded-3xl overflow-hidden ring-1 ring-slate-200/80 shadow-lg shadow-slate-200/50 group"
          >
            <motion.div animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="aspect-[4/5]">
              <Image src={FEATURE_IMG} alt="Animasiýa kartasy" className="w-full h-full" fittingType="fill" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <h3 className="text-white font-bold text-lg drop-shadow-lg">Özleşdirilen wizual</h3>
              <p className="text-white/85 text-sm mt-1 drop-shadow">Çalt hereketli 3D render</p>
            </div>
          </motion.div>

          <motion.div
            {...reveal}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-3 p-6 rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-900">Hepdelik ösüş</h3>
                <p className="text-sm text-slate-400 mt-0.5">Soňky 7 gün</p>
              </div>
              <div className="flex gap-1.5">
                {["Hepde", "Aý", "Ýyl"].map((t, idx) => (
                  <button
                    key={t}
                    onClick={() => setActive(idx)}
                    className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${active === idx ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 h-44">
              {chartData.map((d, i) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(d.value / 100) * 160}px` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-400 to-violet-400 min-h-[2px] hover:from-indigo-500 hover:to-violet-500 transition-colors"
                  />
                  <span className="text-[11px] text-slate-400 font-medium">{d.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features grid with images */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-10">
        <motion.div {...reveal} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Aýratynlyklar</h2>
          <p className="mt-3 text-slate-500 max-w-lg mx-auto">Her bölegi özleşdirip bilýäň, çalt we güwançli.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...reveal}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="p-6 rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-2xl ${f.tint} flex items-center justify-center`}>
                <f.icon className={`w-6 h-6 ${f.iconColor}`} />
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Ribbon image banner */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <motion.div
          {...reveal}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden ring-1 ring-slate-200/80 shadow-xl shadow-slate-200/50"
        >
          <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="aspect-[16/6]">
            <Image src={RIBBON_IMG} alt="Açyklyk" className="w-full h-full" fittingType="fill" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-transparent to-transparent flex items-center">
            <div className="p-8 md:p-14 max-w-md">
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900">Açyklyk bilen döret</h3>
              <p className="mt-2 text-slate-600">Ýumşak formalar, arassa reňkler — göz ýelgemeýän vizual.</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Analytics image split */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <motion.div
            {...reveal}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-3xl overflow-hidden ring-1 ring-slate-200/80 shadow-lg shadow-slate-200/50"
          >
            <div className="aspect-[4/3]">
              <Image src={ANALYTICS_IMG} alt="Analitika" className="w-full h-full" fittingType="fill" />
            </div>
          </motion.div>
          <motion.div {...reveal} transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Maglumaty görkez</h2>
            <p className="mt-3 text-slate-500 leading-relaxed">
              Grafikler, sanlar, trendler — hemmesi animasiýa bilen ýüze çykýar. Ulanyjy gözüne ýakymly, okap aňsat.
            </p>
            <ul className="mt-6 space-y-3">
              {["Canly grafikler", "Özleşdirilen kartlar", "Akylly filtrler"].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 py-14">
        <motion.div
          {...reveal}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-10 md:p-16 text-center"
        >
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <h2 className="relative text-3xl md:text-4xl font-bold text-white tracking-tight">Taýýarmy?</h2>
          <p className="relative mt-3 text-white/85 max-w-md mx-auto">Birnäçe sekuntda öz dashboardyňy döret.</p>
          <button className="relative mt-7 h-12 px-8 rounded-full bg-white text-slate-900 font-semibold hover:scale-105 transition-transform shadow-xl">
            Başla
          </button>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200/60 py-8">
        <p className="text-center text-sm text-slate-400">© 2026 InteraWeb Demo</p>
      </footer>
    </div>
  );
}