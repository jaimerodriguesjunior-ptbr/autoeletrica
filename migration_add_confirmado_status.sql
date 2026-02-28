-- Adicionar 'confirmado' ao CHECK constraint da coluna status em appointments
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu'));
