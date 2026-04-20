-- Migration to add payment_intent to work_orders
-- This field will store the customer's intended payment method during approval.

ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS payment_intent TEXT;

COMMENT ON COLUMN work_orders.payment_intent IS 'Intenção de pagamento informada pelo cliente no portal (ex: PIX, Cartão, Dinheiro)';
