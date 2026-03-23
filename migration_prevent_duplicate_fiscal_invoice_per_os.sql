-- Impede emissao duplicada de notas de saida por OS/tipo/ambiente,
-- inclusive em cenarios concorrentes (abas diferentes ou dois usuarios).

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_active_os_lookup
ON fiscal_invoices (organization_id, work_order_id, tipo_documento, environment)
WHERE work_order_id IS NOT NULL
  AND direction = 'output'
  AND status IN ('draft', 'processing', 'authorized');

CREATE OR REPLACE FUNCTION prevent_duplicate_active_fiscal_invoice_per_os()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.work_order_id IS NULL
       OR COALESCE(NEW.direction, 'output') <> 'output'
       OR NEW.tipo_documento NOT IN ('NFCe', 'NFSe')
       OR COALESCE(NEW.status, 'draft') NOT IN ('draft', 'processing', 'authorized') THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext(
            CONCAT_WS(
                ':',
                NEW.organization_id::text,
                NEW.work_order_id::text,
                NEW.tipo_documento,
                COALESCE(NEW.environment, 'production')
            )
        )
    );

    IF EXISTS (
        SELECT 1
        FROM fiscal_invoices fi
        WHERE fi.organization_id = NEW.organization_id
          AND fi.work_order_id = NEW.work_order_id
          AND fi.tipo_documento = NEW.tipo_documento
          AND COALESCE(fi.environment, 'production') = COALESCE(NEW.environment, 'production')
          AND COALESCE(fi.direction, 'output') = 'output'
          AND COALESCE(fi.status, 'draft') IN ('draft', 'processing', 'authorized')
          AND fi.id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'Ja existe % ativa para esta OS neste ambiente.', NEW.tipo_documento
            USING ERRCODE = '23505';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_fiscal_invoice_per_os ON fiscal_invoices;

CREATE TRIGGER trg_prevent_duplicate_active_fiscal_invoice_per_os
BEFORE INSERT OR UPDATE OF work_order_id, tipo_documento, environment, direction, status
ON fiscal_invoices
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_active_fiscal_invoice_per_os();
