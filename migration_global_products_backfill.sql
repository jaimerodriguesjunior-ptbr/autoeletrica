-- ============================================================
-- BACKFILL: Popula global_products com produtos existentes
-- Rodar APÓS migration_global_products.sql
-- ============================================================

-- Insere um registro por EAN único (primeiro cadastrado vence)
-- Ignora duplicatas silenciosamente (ON CONFLICT DO NOTHING)

INSERT INTO global_products (ean, name, brand, reference_code)
SELECT DISTINCT ON (ean)
  ean,
  nome,
  NULLIF(marca, '') AS brand,
  NULLIF(codigo_ref, '') AS reference_code
FROM products
WHERE
  ean IS NOT NULL
  AND ean ~ '^\d{8}$|^\d{12}$|^\d{13}$'
ORDER BY ean, created_at ASC
ON CONFLICT (ean) DO NOTHING;

-- Confirmar quantos foram inseridos
SELECT COUNT(*) AS total_global FROM global_products;
