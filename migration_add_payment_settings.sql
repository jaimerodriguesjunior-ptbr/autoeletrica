-- Adicionar configurações de pagamento e visibilidade no portal
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS fin_mostrar_portal BOOLEAN DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS fin_cartao_com_juros BOOLEAN DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS fin_taxa_juros_mes NUMERIC DEFAULT 0;
