-- Keep the shared product catalog in sync with every local product write.
-- Safe to run after migration_global_products.sql.

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS global_product_id UUID REFERENCES public.global_products(id);

-- The shared catalog is readable by signed-in users, but only database code
-- (the trigger below) and the service role may write to it.
ALTER TABLE public.global_products ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'global_products'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.global_products',
      policy_record.policyname
    );
  END LOOP;
END;
$$;
DROP POLICY IF EXISTS "global_products_insert" ON public.global_products;
DROP POLICY IF EXISTS "global_products_update" ON public.global_products;
DROP POLICY IF EXISTS "global_products_delete" ON public.global_products;
DROP POLICY IF EXISTS "global_products_select" ON public.global_products;
CREATE POLICY "global_products_select" ON public.global_products
  FOR SELECT TO authenticated USING (true);

-- A product with an EAN-8, UPC-A, EAN-13, or GTIN-14 contributes one shared
-- entry.
-- The earliest entry for an EAN remains authoritative; another store cannot
-- overwrite its name, brand, or reference code.
CREATE OR REPLACE FUNCTION public.sync_product_to_global_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_ean text := regexp_replace(COALESCE(NEW.ean, ''), '\D', '', 'g');
  matching_global_product_id uuid;
BEGIN
  IF normalized_ean !~ '^(\d{8}|\d{12}|\d{13}|\d{14})$'
     OR NULLIF(btrim(COALESCE(NEW.nome, '')), '') IS NULL THEN
    NEW.global_product_id := NULL;
    RETURN NEW;
  END IF;

  INSERT INTO public.global_products (ean, name, brand, reference_code)
  VALUES (
    normalized_ean,
    btrim(NEW.nome),
    NULLIF(btrim(COALESCE(NEW.marca, '')), ''),
    NULLIF(btrim(COALESCE(NEW.codigo_ref, '')), '')
  )
  ON CONFLICT (ean) DO NOTHING;

  SELECT id
    INTO matching_global_product_id
    FROM public.global_products
   WHERE ean = normalized_ean;

  NEW.global_product_id := matching_global_product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_global_catalog ON public.products;
CREATE TRIGGER products_sync_global_catalog
  BEFORE INSERT OR UPDATE OF ean, nome, marca, codigo_ref
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_to_global_catalog();

-- Reconcile products that already existed before the trigger. Normalization is
-- only used for catalog matching; the original EAN stored in products is kept.
INSERT INTO public.global_products (ean, name, brand, reference_code)
SELECT DISTINCT ON (normalized_ean)
  normalized_ean,
  product_name,
  product_brand,
  product_reference_code
FROM (
  SELECT
    regexp_replace(COALESCE(ean, ''), '\D', '', 'g') AS normalized_ean,
    btrim(nome) AS product_name,
    NULLIF(btrim(COALESCE(marca, '')), '') AS product_brand,
    NULLIF(btrim(COALESCE(codigo_ref, '')), '') AS product_reference_code,
    created_at
  FROM public.products
) AS eligible_products
WHERE normalized_ean ~ '^(\d{8}|\d{12}|\d{13}|\d{14})$'
  AND NULLIF(product_name, '') IS NOT NULL
ORDER BY normalized_ean, created_at ASC NULLS LAST
ON CONFLICT (ean) DO NOTHING;

UPDATE public.products AS product
   SET global_product_id = global_product.id
  FROM public.global_products AS global_product
 WHERE regexp_replace(COALESCE(product.ean, ''), '\D', '', 'g') = global_product.ean
   AND regexp_replace(COALESCE(product.ean, ''), '\D', '', 'g') ~ '^(\d{8}|\d{12}|\d{13}|\d{14})$'
   AND product.global_product_id IS DISTINCT FROM global_product.id;

UPDATE public.products
   SET global_product_id = NULL
 WHERE (ean IS NULL OR regexp_replace(ean, '\D', '', 'g') !~ '^(\d{8}|\d{12}|\d{13}|\d{14})$')
   AND global_product_id IS NOT NULL;

-- The legacy RPC is no longer needed by browser code. Keep it only for trusted
-- server-side jobs that may still use it.
REVOKE ALL ON FUNCTION public.upsert_global_product(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_global_product(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_global_product(text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_global_product(text, text, text, text) TO service_role;

COMMIT;
