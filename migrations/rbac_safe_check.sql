-- RBAC deploy: data LOSS ýOK. Diňe barlamak / optional clean.
-- Gateway SQLite (staff, tenants) — öňki maglumatlar saklanýar.
-- Login-daky mapRole diňe JWT-de üýtgedýärdi; DB role-lar ähtimal eýýäm dogry.

-- 1) Role paýlanyşy
SELECT role, COUNT(*) AS n FROM staff GROUP BY role;

-- 2) Super admin sany (iň az 1 bolmaly)
SELECT COUNT(*) AS super_count FROM staff
WHERE lower(role) = 'super_admin' AND IFNULL(active,1) = 1;

-- 3) tenant_slugs boş bolsa tenant_slug-dan doldur (optional, howpsuz)
-- UPDATE staff
-- SET tenant_slugs = json_array(tenant_slug)
-- WHERE (tenant_slugs IS NULL OR tenant_slugs = '' OR tenant_slugs = '[]')
--   AND tenant_slug IS NOT NULL AND tenant_slug != '';

-- 4) Nädogry role ýazgylary (optional)
-- SELECT id, username, role FROM staff
-- WHERE lower(role) NOT IN ('viewer','editor','admin','super_admin');

-- BI local data/ (Next data folder) — sync cache; VPS primary.
-- Backup hökmünde deploy öň:
--   copy data\*.json  we  gateway sqlite file
