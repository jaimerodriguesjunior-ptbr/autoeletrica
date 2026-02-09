ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS nfse_login TEXT,
ADD COLUMN IF NOT EXISTS nfse_password TEXT;
