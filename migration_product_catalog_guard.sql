BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.work_order_items
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS catalog_status TEXT NOT NULL DEFAULT 'resolved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'work_order_items_catalog_status_check'
  ) THEN
    ALTER TABLE public.work_order_items
      ADD CONSTRAINT work_order_items_catalog_status_check
      CHECK (catalog_status IN ('resolved', 'pending', 'dismissed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_work_order_items_pending_catalog
  ON public.work_order_items (organization_id, catalog_status)
  WHERE catalog_status = 'pending';

CREATE OR REPLACE FUNCTION public.normalize_product_catalog_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(unaccent(upper(btrim(COALESCE(value, '')))), '[^A-Z0-9]+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_product_catalog_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duplicate_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    COALESCE(NEW.organization_id::text, '') || '|' ||
    public.normalize_product_catalog_text(NEW.nome) || '|' ||
    public.normalize_product_catalog_text(NULLIF(NEW.marca, '')), 0
  ));

  SELECT id INTO duplicate_id
    FROM public.products
   WHERE organization_id = NEW.organization_id
     AND public.normalize_product_catalog_text(nome) = public.normalize_product_catalog_text(NEW.nome)
     AND public.normalize_product_catalog_text(NULLIF(marca, '')) = public.normalize_product_catalog_text(NULLIF(NEW.marca, ''))
     AND id IS DISTINCT FROM NEW.id
   LIMIT 1;

  IF duplicate_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um produto com o mesmo nome e marca nesta loja.'
      USING ERRCODE = '23505', DETAIL = duplicate_id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_prevent_duplicate_catalog_entry ON public.products;
CREATE TRIGGER products_prevent_duplicate_catalog_entry
  BEFORE INSERT OR UPDATE OF nome, marca, organization_id
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_product_catalog_entry();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_service_catalog_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    COALESCE(NEW.organization_id::text, '') || '|service|' ||
    public.normalize_product_catalog_text(NEW.nome), 0
  ));

  IF EXISTS (
    SELECT 1
      FROM public.services
     WHERE organization_id = NEW.organization_id
       AND public.normalize_product_catalog_text(nome) = public.normalize_product_catalog_text(NEW.nome)
       AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe um serviço com o mesmo nome nesta loja.'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_prevent_duplicate_catalog_entry ON public.services;
CREATE TRIGGER services_prevent_duplicate_catalog_entry
  BEFORE INSERT OR UPDATE OF nome, organization_id
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_service_catalog_entry();

COMMIT;
