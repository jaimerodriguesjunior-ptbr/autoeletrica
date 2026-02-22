-- =====================================================
-- Migration: Criação da Tabela de Códigos OBD-II
-- Data: 2026-02-22
-- =====================================================

CREATE TABLE IF NOT EXISTS public.obd2_codes (
    code VARCHAR(10) PRIMARY KEY,
    description_pt TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100) NULL, -- Nulo para códigos genéricos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.obd2_codes ENABLE ROW LEVEL SECURITY;

-- Política de Leitura Pública
-- Todos os usuários (autenticados ou não) podem ler os códigos OBD-II
CREATE POLICY "Leitura pública de códigos OBD-II"
ON public.obd2_codes
FOR SELECT
USING (true);

-- Criar index para busca rápida por termo na descrição (Opcional, mas recomendado)
CREATE INDEX IF NOT EXISTS idx_obd2_codes_description_pt ON public.obd2_codes USING gin (to_tsvector('portuguese', description_pt));
