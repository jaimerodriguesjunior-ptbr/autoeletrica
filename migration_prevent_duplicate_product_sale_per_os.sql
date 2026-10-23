-- Aplicar antes de publicar os novos atalhos. Nao altera notas existentes.
-- Regra equivalente a isProductSaleInvoice em src/lib/work-order-fiscal.ts.
BEGIN;
CREATE OR REPLACE FUNCTION fiscal_is_product_sale(document_type text, fiscal_payload jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF jsonb_typeof(fiscal_payload) = 'string' THEN
        BEGIN
            fiscal_payload := (fiscal_payload #>> '{}')::jsonb;
        EXCEPTION WHEN invalid_text_representation THEN
            fiscal_payload := NULL;
        END;
    END IF;
    RETURN CASE
        WHEN document_type = 'NFCe' THEN true
        WHEN document_type IS DISTINCT FROM 'NFe' THEN false
        ELSE COALESCE(fiscal_payload #>> '{infNFe,ide,finNFe}', '1') = '1'
         AND COALESCE(fiscal_payload #>> '{infNFe,ide,tpNF}', '1') = '1'
         AND (COALESCE(btrim(fiscal_payload #>> '{infNFe,ide,natOp}'), '') = ''
              OR upper(btrim(fiscal_payload #>> '{infNFe,ide,natOp}')) ~ '^VENDA([[:space:]]|$)')
    END;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_fiscal_active_product_sale_os
ON fiscal_invoices (organization_id, work_order_id, environment)
WHERE direction = 'output' AND work_order_id IS NOT NULL
  AND status IN ('draft', 'pending', 'processing', 'authorized');

CREATE OR REPLACE FUNCTION prevent_duplicate_active_fiscal_invoice_per_os()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    document_group text;
BEGIN
    IF NEW.work_order_id IS NULL
       OR COALESCE(NEW.direction, 'output') <> 'output'
       OR COALESCE(NEW.status, 'draft') NOT IN ('draft', 'pending', 'processing', 'authorized') THEN
        RETURN NEW;
    END IF;

    IF NEW.tipo_documento = 'NFSe' THEN
        document_group := 'NFSe';
    ELSIF fiscal_is_product_sale(NEW.tipo_documento, NEW.payload_json) THEN
        document_group := 'product-sale';
    ELSE
        -- Preserva remessas, retornos, devolucoes e outras naturezas especiais.
        RETURN NEW;
    END IF;

    -- Permite sincronizar documentos legados ja ativos, inclusive quando ha
    -- duplicidades historicas. A entrada de uma nova nota ativa continua protegida.
    IF TG_OP = 'UPDATE' THEN
      IF OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id
       AND OLD.work_order_id IS NOT DISTINCT FROM NEW.work_order_id
       AND COALESCE(OLD.environment, 'production') = COALESCE(NEW.environment, 'production')
       AND COALESCE(OLD.direction, 'output') = 'output'
       AND COALESCE(OLD.status, 'draft') IN ('draft', 'pending', 'processing', 'authorized')
       AND ((document_group = 'NFSe' AND OLD.tipo_documento = 'NFSe')
            OR (document_group = 'product-sale' AND fiscal_is_product_sale(OLD.tipo_documento, OLD.payload_json))) THEN
        RETURN NEW;
      END IF;
    END IF;

    -- A mesma chave para NFC-e e NF-e serializa insercoes concorrentes de venda.
    PERFORM pg_advisory_xact_lock(hashtextextended(
        concat_ws(':', NEW.organization_id::text, NEW.work_order_id::text,
                  document_group, COALESCE(NEW.environment, 'production')), 0));

    IF EXISTS (
        SELECT 1 FROM fiscal_invoices fi
        WHERE fi.organization_id = NEW.organization_id
          AND fi.work_order_id = NEW.work_order_id
          AND COALESCE(fi.environment, 'production') = COALESCE(NEW.environment, 'production')
          AND COALESCE(fi.direction, 'output') = 'output'
          AND COALESCE(fi.status, 'draft') IN ('draft', 'pending', 'processing', 'authorized')
          AND fi.id IS DISTINCT FROM NEW.id
          AND ((document_group = 'NFSe' AND fi.tipo_documento = 'NFSe')
               OR (document_group = 'product-sale' AND fiscal_is_product_sale(fi.tipo_documento, fi.payload_json)))
    ) THEN
        RAISE EXCEPTION 'Ja existe nota % ativa para esta OS neste ambiente.', document_group
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_fiscal_invoice_per_os ON fiscal_invoices;
CREATE TRIGGER trg_prevent_duplicate_active_fiscal_invoice_per_os
BEFORE INSERT OR UPDATE OF organization_id, work_order_id, tipo_documento, environment, direction, status, payload_json
ON fiscal_invoices FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_active_fiscal_invoice_per_os();
COMMIT;
