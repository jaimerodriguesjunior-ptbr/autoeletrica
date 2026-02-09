-- Create fiscal_invoices table
CREATE TABLE IF NOT EXISTS fiscal_invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    work_order_id bigint REFERENCES work_orders(id),
    
    -- Nuvem Fiscal Data
    nuvemfiscal_uuid text,
    status text DEFAULT 'draft', -- draft, processing, authorized, error, cancelled
    environment text DEFAULT 'homologation', -- homologation, production
    
    -- Invoice Details
    tipo_documento text NOT NULL, -- 'NFCe' or 'NFSe'
    numero text,
    serie text,
    chave_acesso text,
    
    -- URLs
    xml_url text,
    pdf_url text,
    
    -- Error Handling
    error_message text,
    
    -- Snapshot of data sent (for drafts and history)
    payload_json jsonb,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_work_order_id ON fiscal_invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_organization_id ON fiscal_invoices(organization_id);
