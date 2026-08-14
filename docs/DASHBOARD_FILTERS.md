# Dashboard filters & API parametrleri

## Akym

1. Electron Admin App-da SQL API döredilýär (`paramsSchema` bilen).
2. Sync → VPS Gateway → catalog (`/api/admin/catalog`).
3. BI Platform `/api/catalog` arkaly endpoint + `paramsSchema` alýar.
4. Widget sazlamasynda API saýlananda parametrler awto peýda bolýar.
5. «Global filter et» → dashboard-da filter bar (beginDate/endDate, gözleg...).
6. Runtime-da `resolveWidgetParams(ds, globalValues)` ähli parametrleri birleşdirýär.
7. `/api/gateway/query` → VPS `/api/v1/{tenant}/{dbKey}{path}?beginDate=...&endDate=...`

## ParamBinding

| source  | Manysy                                      |
|---------|---------------------------------------------|
| global  | Dashboard filter bar-daky key-den alýar     |
| fixed   | Widget-de saklanan sabit baha               |
| widget  | Widget-içi override (geljekde local row)    |

## GlobalFilterDef.type

- `daterange` — begin + end (endKey)
- `date` / `datetime`
- `text` — gözleg
- `number` / `boolean` / `select`

## Default sene

Filter bar açylanda daterange üçin soňky 30 gün awto goýulýar.
