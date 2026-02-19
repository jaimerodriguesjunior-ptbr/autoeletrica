-- Adiciona suporte para Notas de Entrada (Compras) na tabela fiscal_invoices existente

ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'output';
COMMENT ON COLUMN fiscal_invoices.direction IS 'entry (entrada/compra) ou output (saída/venda)';

ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS xml_content TEXT;
COMMENT ON COLUMN fiscal_invoices.xml_content IS 'Conteúdo completo do XML (Base64 ou Texto)';

ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS valor_total NUMERIC(15,2);
ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS emitente_nome TEXT;
ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS emitente_cnpj TEXT;
ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS destinatario_nome TEXT;
ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS destinatario_cnpj TEXT;
ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS data_emissao TIMESTAMP WITH TIME ZONE;
ALTER TABLE fiscal_invoices ADD COLUMN IF NOT EXISTS chave_acesso TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_direction ON fiscal_invoices(direction);
