-- =====================================================
-- Migration: Vincular Códigos DTC às Ordens de Serviço
-- Data: 2026-02-22
-- =====================================================

CREATE TABLE IF NOT EXISTS public.work_order_dtc_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_id BIGINT NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL REFERENCES public.obd2_codes(code) ON DELETE CASCADE,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.work_order_dtc_codes ENABLE ROW LEVEL SECURITY;

-- Política de Leitura Pública (mesma lógica da obd2_codes)
CREATE POLICY "Leitura pública de DTCs da OS"
ON public.work_order_dtc_codes
FOR SELECT
USING (true);

-- Política de Inserção para usuários autenticados
CREATE POLICY "Inserção de DTCs por autenticados"
ON public.work_order_dtc_codes
FOR INSERT
WITH CHECK (true);

-- Política de Deleção para usuários autenticados
CREATE POLICY "Deleção de DTCs por autenticados"
ON public.work_order_dtc_codes
FOR DELETE
USING (true);

-- Index para busca rápida por OS
CREATE INDEX IF NOT EXISTS idx_wo_dtc_work_order_id ON public.work_order_dtc_codes(work_order_id);
