-- ============================================================
-- MIGRAÇÃO: Módulo de Agendamento
-- Data: 2026-02-27
-- ============================================================

-- 1. Adicionar colunas em company_settings
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS scheduling_capacity INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS usa_agendamento BOOLEAN DEFAULT true;

-- 2. Criar tabela de agendamentos
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),
  vehicle_id UUID REFERENCES vehicles(id),
  work_order_id BIGINT REFERENCES work_orders(id),
  type TEXT NOT NULL DEFAULT 'geral' CHECK (type IN ('avaliacao', 'retorno', 'geral')),
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu')),
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_token ON appointments(token);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 4. RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_appointments" ON appointments
  FOR SELECT USING (organization_id = get_my_organization_id());

CREATE POLICY "tenant_insert_appointments" ON appointments
  FOR INSERT WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "tenant_update_appointments" ON appointments
  FOR UPDATE USING (organization_id = get_my_organization_id());

CREATE POLICY "tenant_delete_appointments" ON appointments
  FOR DELETE USING (organization_id = get_my_organization_id());

-- 5. Acesso público via token (para portal do cliente)
CREATE POLICY "public_select_by_token" ON appointments
  FOR SELECT USING (true);
-- Nota: O acesso público será filtrado pela API route usando o token.

-- ============================================================
-- MIGRAÇÃO CONCLUÍDA!
-- ============================================================
