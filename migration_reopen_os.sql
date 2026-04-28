-- Adiciona PIN de gerência para reabrir OS finalizadas
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS manager_pin TEXT;
