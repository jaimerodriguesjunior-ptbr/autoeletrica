-- ============================================================
-- MIGRATION: Sistema de Comissões
-- ============================================================
-- Executa no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar usa_comissao à company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS usa_comissao boolean DEFAULT false;

-- 2. Adicionar comissao_percentual à profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS comissao_percentual numeric DEFAULT 0;

-- 3. Adicionar employee_id à work_orders (quem abriu a OS)
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES profiles(id);

-- 4. Criar tabela de atribuição de profissionais por item de serviço
CREATE TABLE IF NOT EXISTS work_order_item_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    work_order_item_id uuid NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE(work_order_item_id, employee_id)
);

-- 5. Criar tabela de comissões
CREATE TABLE IF NOT EXISTS commissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL,
    work_order_id integer NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    work_order_item_id uuid REFERENCES work_order_items(id) ON DELETE SET NULL,
    employee_id uuid NOT NULL REFERENCES profiles(id),
    amount numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 6. Habilitar RLS nas novas tabelas
ALTER TABLE work_order_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para work_order_item_assignments
CREATE POLICY "woia_select_org" ON work_order_item_assignments
    FOR SELECT USING (organization_id = get_my_organization_id());

CREATE POLICY "woia_insert_org" ON work_order_item_assignments
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "woia_delete_org" ON work_order_item_assignments
    FOR DELETE USING (organization_id = get_my_organization_id());

-- 8. Políticas RLS para commissions
CREATE POLICY "commissions_select_org" ON commissions
    FOR SELECT USING (organization_id = get_my_organization_id());

CREATE POLICY "commissions_insert_org" ON commissions
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());

CREATE POLICY "commissions_update_org" ON commissions
    FOR UPDATE USING (organization_id = get_my_organization_id());

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_commissions_employee ON commissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_commissions_work_order ON commissions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_woia_item ON work_order_item_assignments(work_order_item_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_employee ON work_orders(employee_id);

-- ============================================================
-- PRONTO! Execute isso no SQL Editor do Supabase.
-- ============================================================
