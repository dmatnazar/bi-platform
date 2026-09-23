/**
 * Demo / Info page CMS content — data/demo-page.json
 * Texts: TM + RU. Partners carousel. Banner slides.
 */
import fs from 'node:fs';
import path from 'node:path';

export type LocalizedText = { tm: string; ru: string };

export type DemoPartner = {
  id: string;
  name: string;
  nameRu?: string;
  /** image URL or data-url */
  iconUrl?: string;
  order: number;
  active: boolean;
};

export type DemoBannerSlide = {
  id: string;
  title: LocalizedText;
  subtitle?: LocalizedText;
  imageUrl?: string;
  linkUrl?: string;
  order: number;
  active: boolean;
};

export type DemoCapability = {
  id: string;
  title: LocalizedText;
  text: LocalizedText;
  icon?: string;
  order: number;
  active: boolean;
};

export type DemoPageContent = {
  updatedAt: string;
  /** Header brand */
  brandTitle: LocalizedText;
  brandSubtitle: LocalizedText;
  heroBadge: LocalizedText;
  heroTitle: LocalizedText;
  heroText: LocalizedText;
  heroCtaPrimary: LocalizedText;
  heroCtaSecondary: LocalizedText;
  capabilitiesTitle: LocalizedText;
  capabilitiesSubtitle: LocalizedText;
  capabilities: DemoCapability[];
  dashboardTitle: LocalizedText;
  dashboardSubtitle: LocalizedText;
  benefitsTitle: LocalizedText;
  benefits: LocalizedText[];
  aboutTitle: LocalizedText;
  aboutText1: LocalizedText;
  aboutText2: LocalizedText;
  partnersTitle: LocalizedText;
  partnersSubtitle: LocalizedText;
  partners: DemoPartner[];
  banners: DemoBannerSlide[];
  /** Banner auto-rotate ms */
  bannerIntervalMs: number;
  contactEmail: string;
  contactPhone: string;
  footerNote: LocalizedText;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'demo-page.json');

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultDemoPageContent(): DemoPageContent {
  return {
    updatedAt: new Date().toISOString(),
    brandTitle: { tm: 'BI Platform — Demo', ru: 'BI Platform — Демо' },
    brandSubtitle: {
      tm: 'Mümkinçilikler · Dashboard · Hasabym Group',
      ru: 'Возможности · Дашборд · Hasabym Group',
    },
    heroBadge: { tm: 'Interaktiw demo', ru: 'Интерактивное демо' },
    heroTitle: {
      tm: 'Analitika we dashboard — siziň biznesiňiz üçin',
      ru: 'Аналитика и дашборды — для вашего бизнеса',
    },
    heroText: {
      tm: 'Platforma widget, filtr, API-şlýuz, rollar we goldawy bir web programmada birleşdirýär. Aşakda janly mysal: filtrleri üýtgediň — KPI, diagramma we tablolar täzelener.',
      ru: 'Платформа объединяет виджеты, фильтры, API-шлюз, роли и поддержку в одном веб-приложении. Ниже — живой пример: меняйте фильтры и смотрите, как обновляются KPI, графики и таблицы.',
    },
    heroCtaPrimary: { tm: 'Dashboard gör', ru: 'Смотреть дашборд' },
    heroCtaSecondary: { tm: 'Hasabym Group', ru: 'Hasabym Group' },
    capabilitiesTitle: { tm: 'Platforma näme edip bilýär', ru: 'Что умеет платформа' },
    capabilitiesSubtitle: {
      tm: 'Hasabat we çalt karar üçin iň köp mümkinçilik',
      ru: 'Максимум возможностей для отчётности и оперативных решений',
    },
    capabilities: [
      {
        id: uid('cap'),
        title: { tm: 'Dashboard-lar', ru: 'Дашборды' },
        text: {
          tm: 'Widget tor, tablar, doly ekran, PNG/JSON eksport, mobile adaptiv.',
          ru: 'Сетка виджетов, вкладки, полноэкранный режим, экспорт PNG/JSON, адаптив под мобильные.',
        },
        icon: 'LayoutDashboard',
        order: 0,
        active: true,
      },
      {
        id: uid('cap'),
        title: { tm: 'Global filtrler', ru: 'Глобальные фильтры' },
        text: {
          tm: 'Sene, döwür, sebit, API sözlükleri — bir filtr ähli bagly widget-leri täzeläýär.',
          ru: 'Дата, период, регион, справочники из API — один фильтр обновляет все связанные виджеты.',
        },
        icon: 'Filter',
        order: 1,
        active: true,
      },
      {
        id: uid('cap'),
        title: { tm: 'Ähli görnüşli diagrammalar', ru: 'Все типы визуализаций' },
        text: {
          tm: 'KPI, çyzyk, area, sütün, tegelek, tablo, drill-down / heirarhiýa, pivot.',
          ru: 'KPI, линия, область, столбцы, круговые, таблицы, drill-down / иерархия, сводные.',
        },
        icon: 'BarChart3',
        order: 2,
        active: true,
      },
    ],
    dashboardTitle: { tm: 'Demo dashboard', ru: 'Демо-дашборд' },
    dashboardSubtitle: {
      tm: 'Döwür we firmalar filtrleri ähli widget bilen bagly — hakyky BI ýaly.',
      ru: 'Фильтры периода и компаний связаны со всеми виджетами — как в реальном BI.',
    },
    benefitsTitle: { tm: 'Näme üçin ornaşdyrmaly', ru: 'Зачем внедрять' },
    benefits: [
      {
        tm: 'Köp firma: her kompaniýa diňe öz maglumatyny görýär',
        ru: 'Мульти-компания: каждая фирма видит только свои данные',
      },
      {
        tm: 'Rollar we rugsatlar — admin, editor, viewer',
        ru: 'Роли и права — admin, editor, viewer',
      },
      {
        tm: 'Goldaw çaty we habarlar bir ýerde',
        ru: 'Чат поддержки и новости в одном месте',
      },
    ],
    aboutTitle: { tm: 'Hasabym Group', ru: 'Hasabym Group' },
    aboutText1: {
      tm: 'Hasabym Group — web platformalary, korporatiw ulgamlary we analitiki çözgütleri dizaýn edýän we ösdürýän topardyr.',
      ru: 'Hasabym Group — команда, которая проектирует и развивает веб-платформы, корпоративные системы и аналитические решения.',
    },
    aboutText2: {
      tm: 'BI Platform-dan daşary sargyt web sahypalar, şahsy kabinetler we awtomatlaşdyrmak boýunça kömek edýäris.',
      ru: 'Помимо BI Platform мы помогаем с заказными сайтами, личными кабинетами и автоматизацией бизнес-процессов.',
    },
    partnersTitle: { tm: 'Biziň bilen işleşýän firmalar', ru: 'Компании, с которыми мы работаем' },
    partnersSubtitle: {
      tm: 'Ynamly hyzmatdaşlar',
      ru: 'Надёжные партнёры',
    },
    partners: [
      {
        id: uid('pt'),
        name: 'Hasabym Group',
        nameRu: 'Hasabym Group',
        iconUrl: '',
        order: 0,
        active: true,
      },
    ],
    banners: [
      {
        id: uid('bn'),
        title: {
          tm: 'BI Platform — täze mümkinçilikler',
          ru: 'BI Platform — новые возможности',
        },
        subtitle: {
          tm: 'Dashboard, filtr we goldaw bir ýerde',
          ru: 'Дашборды, фильтры и поддержка в одном месте',
        },
        imageUrl: '',
        linkUrl: '#dashboard',
        order: 0,
        active: true,
      },
    ],
    bannerIntervalMs: 5000,
    contactEmail: 'info@hasabym.group',
    contactPhone: '+993',
    footerNote: {
      tm: 'Hasabym Group · BI Platform',
      ru: 'Hasabym Group · BI Platform',
    },
  };
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(defaultDemoPageContent(), null, 2), 'utf8');
  }
}

export function readDemoPageContent(): DemoPageContent {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as DemoPageContent;
    const def = defaultDemoPageContent();
    return {
      ...def,
      ...raw,
      capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : def.capabilities,
      benefits: Array.isArray(raw.benefits) ? raw.benefits : def.benefits,
      partners: Array.isArray(raw.partners) ? raw.partners : def.partners,
      banners: Array.isArray(raw.banners) ? raw.banners : def.banners,
    };
  } catch {
    return defaultDemoPageContent();
  }
}

export function writeDemoPageContent(content: DemoPageContent): DemoPageContent {
  ensure();
  const next = {
    ...content,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
