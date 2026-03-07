-- Migração: adicionar public_token para portal do cliente
-- Execute este SQL no Editor SQL do Supabase

-- 1. Criar a coluna
ALTER TABLE clients ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

-- 2. Preencher todos os clientes existentes com um token aleatório
UPDATE clients SET public_token = md5(random()::text || clock_timestamp()::text) WHERE public_token IS NULL;
