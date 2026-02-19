-- Adiciona coluna para data da última compra/entrada no estoque
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS data_ultima_compra TIMESTAMP WITH TIME ZONE;

-- Comentário para documentação
COMMENT ON COLUMN products.data_ultima_compra IS 'Data da última entrada de estoque (compra/xml/ajuste)';
