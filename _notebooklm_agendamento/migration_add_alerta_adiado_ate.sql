-- Criação do campo alerta_adiado_ate na tabela appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS alerta_adiado_ate TIMESTAMPTZ;
