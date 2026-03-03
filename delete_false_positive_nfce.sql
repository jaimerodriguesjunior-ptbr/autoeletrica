-- Para visualizar as notas de NFC-e (verifique os IDs para não apagar a nota errada)
SELECT id, tipo_documento, status, created_at, environment
FROM fiscal_invoices
WHERE tipo_documento = 'NFCe';

-- Quando tiver certeza do ID, substitua o 'ID_DA_NOTA_AQUI' abaixo e execute:
-- DELETE FROM fiscal_invoices WHERE id = 'ID_DA_NOTA_AQUI';
