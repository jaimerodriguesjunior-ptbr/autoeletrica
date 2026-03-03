-- Adiciona coluna para forma de pagamento na tabela de transações
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

COMMENT ON COLUMN transactions.payment_method IS 'pix, cartao_credito, cartao_debito, dinheiro, boleto, cheque_pre';

-- Script de Migração de Dados Históricos
-- Tenta inferir a forma de pagamento a partir da descrição para registros antigos
UPDATE transactions
SET payment_method = 'pix'
WHERE payment_method IS NULL AND description ILIKE '%(pix)%';

UPDATE transactions
SET payment_method = 'cartao_credito'
WHERE payment_method IS NULL AND description ILIKE '%(cartao_credito)%';

UPDATE transactions
SET payment_method = 'cartao_debito'
WHERE payment_method IS NULL AND description ILIKE '%(cartao_debito)%';

UPDATE transactions
SET payment_method = 'dinheiro'
WHERE payment_method IS NULL AND description ILIKE '%(dinheiro)%';

UPDATE transactions
SET payment_method = 'boleto'
WHERE payment_method IS NULL AND description ILIKE '%(boleto)%';

UPDATE transactions
SET payment_method = 'cheque_pre'
WHERE payment_method IS NULL AND (description ILIKE '%(cheque_pre)%' OR description ILIKE '%(cheque)%');

