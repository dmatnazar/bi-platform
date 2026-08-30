# Üýtgedilen kodlar — bi-platform

Bu zip diňe üýtgedilen faýllary saklaýar (asyl papka gurluşyny saklap).
`vps-gateway` proýektinde hiç hili üýtgeşme edilmedi — balans/billing logikasy
(admin free, viewer REQ görä azalýar) VPS tarapynda eýýäm dogry işleýärdi;
mesele diňe frontend-de görkezilmändigi bardy (aşakda ýazylan).

## 1) Balans hiç haçan görünmeýärdi (kritiki bug)
`src/components/layout/Sidebar.tsx`
- `<BalanceBadge compact />` hiç bir prop bilen çagyrylýardy, ýöne komponent
  `companySlug` bolmasa hiç zat render etmeýär (`return null`). Netijede
  ähli ulanyjylar üçin balans elmydama gizlindi.
- Indi `companySlug`, `username`, `role` iberilýär → admin bolsa "Admin· free"
  bellik, beýlekiler üçin bolsa hakyky "REQ / TMT" balans + reňkli duýduryş görünýär.

`src/app/(app)/profile/page.tsx`
- Profil sahypasynyň ýokarsyna-da şol balans widget-i goşuldy (haýyşdaky
  "Profiliň ýanynda balans" talaby üçin).

## 2) Tablo widget-de scroll "gapananda" sahypa süýşenokdy
`src/components/charts/ChartWidget.tsx`
- Içki tablo scroll konteýnerlerinde `overscroll-behavior: contain` bardy —
  bu häsiýet edil requestde ýazylan ýaly, ulanyjy tablony ahyryna çenli
  scroll edenden soň sahypanyň galan bölegine geçmegi bloklaýardy.
  `overscroll-behavior: auto` edildi (desktop hem mobile tablo görnüşi) —
  indi tablonyň ahyryna ýetilende scroll tebigy ýagdaýda sahypa geçýär.

## 3) API modalda: ilki Firma, soň şol firmanyň Connection-y
`src/app/(app)/admin/apis/page.tsx`
- "Firma" saýlawy diňe API döredilende görünýärdi we "dbKey" erkin ýazylýan
  tekst meýdança boldy — firmanyň hakyky DB baglanyşyklaryna baglanyşyksyzdy.
- Indi Firma hemişe görkezilýär (üýtgetmede disabled, sebäbi bar bolan API-de
  firma çalyşmak howply), we dbKey ýerine saýlanan firmanyň hakyky
  connection sanawyndan (`tenant.connections`) dropdown geldi + "el bilen ýaz"
  fallback-y bar edge-case üçin. Firma üýtgände dbKey awtomatik şol firmanyň
  ilkinji connection-yna reset bolýar.

## 4) "Modal title şablony" — has aňsat column ulanmak
`src/components/dashboard/WidgetConfigPanel.tsx`
- Bu meýdança eýýäm islendik `{columnName}` ýazsaň şol column-yň maglumatyny
  goýýardy, ýöne muny tapmak kyn bolýardy. Indi `<datalist>` autocomplete
  goşuldy (ähli sample column-lar + `{field}`/`{value}`) we haýsy column
  bolsa-da (görkezilýän list-de ýok bolsa hem) ýazyp bolýandygy düşündirildi.

## 5) Sütünler saýlawy mobilde işlänokdy
`src/components/ui/DataTable.tsx`
- "Sütünler" (column picker) düwmesi `hidden sm:block` bilen mobilde
  düýbünden gizlenýärdi. Indi mobilde-de elýeterli, dropdown ini ekrana görä
  (`min(14rem, 100vw-2rem)`) çäklendirilýär welin ekrandan çykyp gitmeýär.

## 6) Widget-lere täze funklar + mobilde ähli funklar elýeterli
`src/components/dashboard/DashboardCanvas.tsx`
- Her widget-e **Täzele** (manual refresh, LiveWidget-i täzeden fetch
  edýär — `refreshToken` arkaly) we **Doly ekran** (fullscreen modal, Esc
  bilen ýapylýar, sahypanyň scroll-yny gulplaýar) düwmeleri goşuldy —
  editable ýa-da dolandyryş rejesine garamazdan hemme ýerde elýeterli.
- Mobilde (≤640px) grid indi mejbury 1 sütün bolup, her widget doly ini
  bilen aşak-aşak ýerleşýär — desktopdaky 12 sütünlik gurluş üýtgemeýär,
  diňe görkeziş wagtynda mobil üçin gaýtadan hasaplanýar (asyl x/y/w/h
  dashboard-da saklanýar, üýtgänok).
- Drag-and-drop mobilde amatsyz bolansoň, editable rejede widget-i
  ýokary/aşak süýşürmek üçin ok düwmeleri goşuldy — mobilde-de tertip
  üýtgedip bolýar (diňe drag ýerine düwme bilen).

`src/components/dashboard/LiveWidget.tsx`
- `refreshToken` prop goşuldy — DashboardCanvas-dan gelen manual-refresh
  islegini fetch effect-iniň dependency sanawyna goşup, derrew täze sorag
  iberýär.

## 7) Tablo widget — CSV eksport
`src/components/charts/ChartWidget.tsx`
- Tablo görnüşindäki widget-iň gurallar zolagyna **CSV** düwmesi goşuldy —
  häzirki görünýän/filtrlenen/tertiplenen setirleri, görünýän sütünleri
  UTF-8 (BOM bilen, Excel-de Türkmen harplary dogry açylar ýaly) CSV faýl
  hökmünde ýükleýär.
