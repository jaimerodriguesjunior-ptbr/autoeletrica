-- =====================================================
-- Migration: Peça do Cliente + Metadados de Aprovação
-- Data: 2026-02-22
-- =====================================================

-- 1. Coluna para marcar peça fornecida pelo cliente
ALTER TABLE work_order_items
ADD COLUMN IF NOT EXISTS peca_cliente BOOLEAN DEFAULT FALSE;

-- 2. Colunas para gravar metadados da aprovação do orçamento
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS aprovacao_ip TEXT,
ADD COLUMN IF NOT EXISTS aprovacao_dispositivo TEXT,
ADD COLUMN IF NOT EXISTS aprovacao_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS aprovacao_versao_hash TEXT;

-- Verificação
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_order_items' AND column_name = 'peca_cliente';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'work_orders' AND column_name LIKE 'aprovacao_%';
