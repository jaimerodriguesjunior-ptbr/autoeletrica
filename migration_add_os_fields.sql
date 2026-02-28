-- Migration para adicionar novos campos de texto à tabela de ordens de serviço

ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS defeitos_constatados TEXT,
ADD COLUMN IF NOT EXISTS servicos_executados TEXT;
