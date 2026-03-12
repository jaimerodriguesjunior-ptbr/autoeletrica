-- Migration: Adicionar coluna 'categoria' à tabela vehicles
-- Executa no Supabase SQL Editor

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'carro';

-- Valores esperados: 'carro', 'moto', 'barco'
-- Comentário: Identificação do tipo de veículo para adaptar o fluxo de OS
COMMENT ON COLUMN vehicles.categoria IS 'Tipo: carro, moto, barco';
