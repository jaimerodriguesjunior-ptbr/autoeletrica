-- Migration: Adicionar campo 'tipo' na tabela work_orders
-- Tipos: 'os' (OS tradicional), 'bancada' (serviço sem veículo), 'venda_balcao' (venda de peças)

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'os';

-- Backfill: Marcar vendas de balcão existentes
-- Critério: sem veículo + status 'entregue' + descrição contém 'Venda'
UPDATE work_orders 
SET tipo = 'venda_balcao' 
WHERE vehicle_id IS NULL 
  AND status = 'entregue' 
  AND (description ILIKE '%Venda%' OR description ILIKE '%Balcão%');

-- Backfill: Marcar serviços de bancada existentes
-- Critério: sem veículo + status NÃO é 'entregue' (ainda está em andamento)
UPDATE work_orders 
SET tipo = 'bancada' 
WHERE vehicle_id IS NULL 
  AND tipo = 'os'
  AND status IN ('aprovado', 'em_andamento', 'aguardando_peca');
