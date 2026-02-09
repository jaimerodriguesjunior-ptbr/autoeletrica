-- Add fiscal fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS ncm text,
ADD COLUMN IF NOT EXISTS cfop text DEFAULT '5102',
ADD COLUMN IF NOT EXISTS unidade text DEFAULT 'UN';

-- Add fiscal fields to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS codigo_servico text,
ADD COLUMN IF NOT EXISTS aliquota_iss numeric DEFAULT 0;
