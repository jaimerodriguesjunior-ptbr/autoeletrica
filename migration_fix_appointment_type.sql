-- ============================================================
-- MIGRAÇÃO: Correção do tipo de agendamento "Já tem OS"
-- Data: 2026-03-05
-- ============================================================

-- Remove a constraint existente que limita os tipos
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_type_check;

-- Cria a nova constraint permitindo o novo tipo 'ja_tem_os'
ALTER TABLE appointments ADD CONSTRAINT appointments_type_check 
  CHECK (type IN ('avaliacao', 'retorno', 'geral', 'ja_tem_os'));

-- ============================================================
-- MIGRAÇÃO CONCLUÍDA!
-- ============================================================
