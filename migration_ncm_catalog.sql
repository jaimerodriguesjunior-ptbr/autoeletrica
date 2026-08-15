-- Migration: Criar tabela do Catálogo NCM Oficial (Siscomex)
-- Permite buscas locais ultrarrápidas por código e descrição

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS ncm_catalog (
    codigo VARCHAR(8) PRIMARY KEY,
    descricao TEXT NOT NULL,
    data_inicio VARCHAR(20),
    data_fim VARCHAR(20),
    tipo VARCHAR(20),
    vigente BOOLEAN DEFAULT true NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garante que a coluna 'vigente' exista mesmo se a tabela foi criada em versão anterior
ALTER TABLE ncm_catalog ADD COLUMN IF NOT EXISTS vigente BOOLEAN DEFAULT true NOT NULL;

-- Índices para otimização de busca
-- Nota: A chave primária (codigo) já possui índice B-Tree automático.
DROP INDEX IF EXISTS idx_ncm_catalog_codigo;
CREATE INDEX IF NOT EXISTS idx_ncm_catalog_descricao_trgm ON ncm_catalog USING gin (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ncm_catalog_vigente ON ncm_catalog (vigente) WHERE vigente = true;

-- Habilitar Row Level Security (RLS)
ALTER TABLE ncm_catalog ENABLE ROW LEVEL SECURITY;

-- Permitir leitura de NCMs apenas para usuários autenticados da aplicação
DROP POLICY IF EXISTS "Permitir leitura de NCMs para anon" ON ncm_catalog;
DROP POLICY IF EXISTS "Permitir leitura de NCMs para autenticados" ON ncm_catalog;
CREATE POLICY "Permitir leitura de NCMs para autenticados" ON ncm_catalog FOR SELECT TO authenticated USING (true);

-- Inserção/atualização permitida exclusivamente via Service Role (operações administrativas/background sync)
DROP POLICY IF EXISTS "Permitir inserção/atualização via service role" ON ncm_catalog;
CREATE POLICY "Permitir inserção/atualização via service role" ON ncm_catalog FOR ALL TO service_role USING (true);
