-- Deletar a empresa duplicada que não tem organization_id
DELETE FROM company_settings 
WHERE organization_id IS NULL 
AND cnpj = '35181069000143';
