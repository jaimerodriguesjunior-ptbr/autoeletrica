-- ============================================================
-- MIGRAÇÃO: Base Global de Produtos
-- ============================================================

-- 1. Tabela global (sem organization_id)
CREATE TABLE IF NOT EXISTS global_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ean TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  reference_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS: SELECT aberto a qualquer usuário autenticado
ALTER TABLE global_products ENABLE ROW LEVEL SECURITY;

-- Limpa todas as policies anteriores (evita erro de organization_id de tentativas antigas)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'global_products' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON global_products';
  END LOOP;
END $$;

CREATE POLICY "global_products_select" ON global_products
  FOR SELECT TO authenticated USING (true);

-- Permite INSERT/UPDATE via service_role (backfill e upsert_global_product)
CREATE POLICY "global_products_insert" ON global_products
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Coluna de rastreabilidade em products
ALTER TABLE products ADD COLUMN IF NOT EXISTS global_product_id UUID REFERENCES global_products(id);

-- 4. RPC para inserir no global (sem duplicata, validando EAN)
CREATE OR REPLACE FUNCTION upsert_global_product(
  p_ean TEXT,
  p_name TEXT,
  p_brand TEXT DEFAULT NULL,
  p_reference_code TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aceita EAN-8, UPC-A (12) e EAN-13
  IF p_ean !~ '^\d{8}$' AND p_ean !~ '^\d{12}$' AND p_ean !~ '^\d{13}$' THEN
    RETURN;
  END IF;

  INSERT INTO global_products (ean, name, brand, reference_code)
  VALUES (p_ean, p_name, p_brand, p_reference_code)
  ON CONFLICT (ean) DO NOTHING;
END;
$$;
