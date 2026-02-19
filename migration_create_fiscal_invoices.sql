-- Tabela para armazenar todas as notas fiscais (Entrada e Saída)
-- Isso servirá de base para o Portal do Contador e para devoluções.

CREATE TABLE IF NOT EXISTS fiscal_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    access_key TEXT UNIQUE, -- Chave de Acesso (44 dígitos)
    xml_content TEXT, -- XML completo em Base64 ou Texto puro
    numero TEXT, -- Número da Nota (nNF)
    serie TEXT, -- Série
    issue_date TIMESTAMP WITH TIME ZONE, -- dhEmi
    issuer_name TEXT, -- Nome do Emitente (Fornecedor ou Nós mesmos)
    issuer_cnpj TEXT, -- CNPJ do Emitente
    recipient_name TEXT, -- Destinatário
    recipient_cnpj TEXT, -- CNPJ/CPF do Destinatário
    total_amount NUMERIC(15,2), -- Valor Total da Nota
    type TEXT CHECK (type IN ('entry', 'output')), -- Entrada (Compra) ou Saída (Venda)
    status TEXT DEFAULT 'authorized', -- authorized, cancelled, denied
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_key ON fiscal_invoices(access_key);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_date ON fiscal_invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_type ON fiscal_invoices(type);

-- RLS (Segurança)
ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization invoices" ON fiscal_invoices
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM organization_members WHERE organization_id = fiscal_invoices.organization_id
    ));

CREATE POLICY "Users can insert invoices" ON fiscal_invoices
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM organization_members WHERE organization_id = fiscal_invoices.organization_id
    ));
