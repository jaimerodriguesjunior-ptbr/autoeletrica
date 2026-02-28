-- ============================================================
-- MIGRAÇÃO: Adicionar tipo 'ja_tem_os' no constraint de type
-- Data: 2026-02-28
-- ============================================================

-- Remove constraint antiga do type
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_type_check;

-- Recria com o novo valor incluído
ALTER TABLE appointments ADD CONSTRAINT appointments_type_check
  CHECK (type IN ('avaliacao', 'retorno', 'geral', 'ja_tem_os'));
