-- Adicionar configurações de markup na importação
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS aplicar_markup_importacao BOOLEAN DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS markup_valor_importacao NUMERIC DEFAULT 2.0;

-- Garantir que a coluna EAN exista na tabela products
ALTER TABLE products ADD COLUMN IF NOT EXISTS ean TEXT;
