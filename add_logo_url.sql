-- =========================================================================
-- SCRIPT DE ATUALIZAÇÃO: Adicionar campo de logo para multi-tenant
-- =========================================================================

-- Adicionamos a coluna logo_url na tabela company_settings.
-- Usaremos isso para armazenar o caminho da imagem (ex: '/logos/logorally.png')
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Atualizamos o logotipo do Norberto (oficina matriz) para seu respectivo arquivo
UPDATE public.company_settings
SET logo_url = '/logos/logonor.png'
WHERE nome_fantasia ILIKE '%norberto%' OR razao_social ILIKE '%norberto%' OR id IS NOT NULL; 
-- (O "id IS NOT NULL" funciona como fallback genérico caso o nome não corresponda, 
-- depois sobrescrevemos a do Rally especificamente).

-- Atualizamos o logotipo do Rally Auto Center
UPDATE public.company_settings
SET logo_url = '/logos/logorally.png'
WHERE nome_fantasia ILIKE '%rally%' OR razao_social ILIKE '%rally%';

-- =========================================================================
-- PRONTO! Rode esse script no SQL Editor do Supabase.
-- Depois de rodar, basta relogar na conta do Rally e salvar as "Configurações" 
-- pela primeira vez para criar a linha (caso ainda não exista).
-- =========================================================================
