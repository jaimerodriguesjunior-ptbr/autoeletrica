-- Este script NÃO altera nada. Ele apenas LISTA as colunas da tabela.
-- Rode no Supabase e verifique se as colunas 'xml_content', 'valor_total' e 'chave_acesso' aparecem na lista.

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fiscal_invoices'
ORDER BY ordinal_position;
