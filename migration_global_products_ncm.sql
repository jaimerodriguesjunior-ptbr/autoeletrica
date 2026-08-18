-- Add fiscal classification to the shared catalog.
-- Safe to run after migration_global_products.sql.

BEGIN;

ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS ncm TEXT;

-- High-confidence matches from public.ncm_catalog:
-- 85071090: lead-acid starter battery, other capacities (this battery is 38 Ah).
UPDATE public.global_products
   SET ncm = '85071090'
 WHERE ean = '4047025140539'
   AND name = 'BATERIA BOSH S6 38AH';

-- 85443000: ignition-wire sets used in vehicles.
UPDATE public.global_products
   SET ncm = '85443000'
 WHERE name ILIKE '%CABO IGNICAO%';

-- 85111000: spark plugs.
UPDATE public.global_products
   SET ncm = '85111000'
 WHERE name ILIKE '%VELA IGNICAO%';

-- 85361000: fuses and fuse circuit breakers up to 1,000 V.
UPDATE public.global_products
   SET ncm = '85361000'
 WHERE name ILIKE 'FUSIVEL%';

-- 85123000: acoustic signalling devices for vehicles.
UPDATE public.global_products
   SET ncm = '85123000'
 WHERE name ILIKE 'BUZINA%';

-- 84133090: other fuel, lubricant or coolant pumps for combustion engines.
UPDATE public.global_products
   SET ncm = '84133090'
 WHERE name ILIKE 'BOMBA OLEO%';

COMMIT;
