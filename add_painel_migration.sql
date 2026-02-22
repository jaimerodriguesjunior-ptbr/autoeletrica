-- =====================================================
-- Migration: Dados do Painel do Veículo
-- Data: 2026-02-22
-- =====================================================

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS odometro TEXT,
ADD COLUMN IF NOT EXISTS nivel_combustivel TEXT,
ADD COLUMN IF NOT EXISTS temperatura_motor TEXT,
ADD COLUMN IF NOT EXISTS painel_obs TEXT,
ADD COLUMN IF NOT EXISTS painel_foto TEXT;

-- Verificação
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'work_orders' AND column_name IN ('odometro', 'nivel_combustivel', 'temperatura_motor', 'painel_obs', 'painel_foto');
