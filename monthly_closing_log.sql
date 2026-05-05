-- Tabela de log de envio mensal do fechamento para o contador
CREATE TABLE IF NOT EXISTS monthly_closing_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL, -- 1 a 12
    sent_at TIMESTAMPTZ,
    status TEXT, -- 'success' | 'error'
    error_message TEXT,
    UNIQUE(organization_id, year, month)
);

ALTER TABLE monthly_closing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_closing_log_policy" ON monthly_closing_log
    FOR ALL
    USING (
        organization_id = (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );
