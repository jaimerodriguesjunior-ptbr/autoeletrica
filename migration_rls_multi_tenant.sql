-- ============================================================
-- SCRIPT DE MIGRAÇÃO: Row Level Security (Multi-Tenant)
-- Data: 2026-02-21 (v2 - com SECURITY DEFINER)
-- 
-- CORREÇÃO: Usar uma função SECURITY DEFINER para resolver
-- o organization_id sem passar pelo RLS de profiles.
-- Isso evita o problema de recursão/bloqueio.
-- ============================================================

-- ============================================================
-- 0. CRIAR FUNÇÃO AUXILIAR (SECURITY DEFINER)
-- Esta função roda com permissões do CRIADOR (superuser),
-- então ela bypassa o RLS de profiles e retorna o org_id.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 1. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. LIMPAR POLÍTICAS ANTERIORES (evitar conflitos)
-- ============================================================

-- clients
DROP POLICY IF EXISTS "tenant_select_clients" ON clients;
DROP POLICY IF EXISTS "tenant_insert_clients" ON clients;
DROP POLICY IF EXISTS "tenant_update_clients" ON clients;
DROP POLICY IF EXISTS "tenant_delete_clients" ON clients;

-- work_orders
DROP POLICY IF EXISTS "tenant_select_work_orders" ON work_orders;
DROP POLICY IF EXISTS "tenant_insert_work_orders" ON work_orders;
DROP POLICY IF EXISTS "tenant_update_work_orders" ON work_orders;
DROP POLICY IF EXISTS "tenant_delete_work_orders" ON work_orders;

-- work_order_items
DROP POLICY IF EXISTS "tenant_select_work_order_items" ON work_order_items;
DROP POLICY IF EXISTS "tenant_insert_work_order_items" ON work_order_items;
DROP POLICY IF EXISTS "tenant_update_work_order_items" ON work_order_items;
DROP POLICY IF EXISTS "tenant_delete_work_order_items" ON work_order_items;

-- transactions
DROP POLICY IF EXISTS "tenant_select_transactions" ON transactions;
DROP POLICY IF EXISTS "tenant_insert_transactions" ON transactions;
DROP POLICY IF EXISTS "tenant_update_transactions" ON transactions;
DROP POLICY IF EXISTS "tenant_delete_transactions" ON transactions;

-- products
DROP POLICY IF EXISTS "tenant_select_products" ON products;
DROP POLICY IF EXISTS "tenant_insert_products" ON products;
DROP POLICY IF EXISTS "tenant_update_products" ON products;
DROP POLICY IF EXISTS "tenant_delete_products" ON products;

-- services
DROP POLICY IF EXISTS "tenant_select_services" ON services;
DROP POLICY IF EXISTS "tenant_insert_services" ON services;
DROP POLICY IF EXISTS "tenant_update_services" ON services;
DROP POLICY IF EXISTS "tenant_delete_services" ON services;

-- vehicles
DROP POLICY IF EXISTS "tenant_select_vehicles" ON vehicles;
DROP POLICY IF EXISTS "tenant_insert_vehicles" ON vehicles;
DROP POLICY IF EXISTS "tenant_update_vehicles" ON vehicles;
DROP POLICY IF EXISTS "tenant_delete_vehicles" ON vehicles;

-- fiscal_invoices
DROP POLICY IF EXISTS "tenant_select_fiscal_invoices" ON fiscal_invoices;
DROP POLICY IF EXISTS "tenant_insert_fiscal_invoices" ON fiscal_invoices;
DROP POLICY IF EXISTS "tenant_update_fiscal_invoices" ON fiscal_invoices;
DROP POLICY IF EXISTS "tenant_delete_fiscal_invoices" ON fiscal_invoices;
DROP POLICY IF EXISTS "Users can view their organization invoices" ON fiscal_invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON fiscal_invoices;

-- company_settings
DROP POLICY IF EXISTS "tenant_select_company_settings" ON company_settings;
DROP POLICY IF EXISTS "tenant_insert_company_settings" ON company_settings;
DROP POLICY IF EXISTS "tenant_update_company_settings" ON company_settings;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_org" ON profiles;

-- organizations
DROP POLICY IF EXISTS "org_select_own" ON organizations;

-- ============================================================
-- 3. CRIAR POLÍTICAS NOVAS (usando get_my_organization_id())
-- ============================================================

-- ----- PROFILES (SEM RECURSÃO - usa auth.uid() direto) -----
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_org" ON profiles
    FOR SELECT USING (organization_id = get_my_organization_id());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- ----- ORGANIZATIONS -----
CREATE POLICY "org_select_own" ON organizations
    FOR SELECT USING (id = get_my_organization_id());

-- ----- CLIENTS -----
CREATE POLICY "tenant_select_clients" ON clients
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_clients" ON clients
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_clients" ON clients
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_clients" ON clients
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- WORK_ORDERS -----
CREATE POLICY "tenant_select_work_orders" ON work_orders
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_work_orders" ON work_orders
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_work_orders" ON work_orders
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_work_orders" ON work_orders
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- WORK_ORDER_ITEMS -----
CREATE POLICY "tenant_select_work_order_items" ON work_order_items
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_work_order_items" ON work_order_items
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_work_order_items" ON work_order_items
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_work_order_items" ON work_order_items
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- TRANSACTIONS -----
CREATE POLICY "tenant_select_transactions" ON transactions
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_transactions" ON transactions
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_transactions" ON transactions
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_transactions" ON transactions
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- PRODUCTS -----
CREATE POLICY "tenant_select_products" ON products
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_products" ON products
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_products" ON products
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_products" ON products
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- SERVICES -----
CREATE POLICY "tenant_select_services" ON services
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_services" ON services
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_services" ON services
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_services" ON services
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- VEHICLES -----
CREATE POLICY "tenant_select_vehicles" ON vehicles
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_vehicles" ON vehicles
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_vehicles" ON vehicles
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_vehicles" ON vehicles
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- FISCAL_INVOICES -----
CREATE POLICY "tenant_select_fiscal_invoices" ON fiscal_invoices
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_fiscal_invoices" ON fiscal_invoices
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_fiscal_invoices" ON fiscal_invoices
    FOR UPDATE USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_delete_fiscal_invoices" ON fiscal_invoices
    FOR DELETE USING (organization_id = get_my_organization_id());

-- ----- COMPANY_SETTINGS -----
CREATE POLICY "tenant_select_company_settings" ON company_settings
    FOR SELECT USING (organization_id = get_my_organization_id());
CREATE POLICY "tenant_insert_company_settings" ON company_settings
    FOR INSERT WITH CHECK (organization_id = get_my_organization_id());
CREATE POLICY "tenant_update_company_settings" ON company_settings
    FOR UPDATE USING (organization_id = get_my_organization_id());

-- ============================================================
-- MIGRAÇÃO v2 CONCLUÍDA!
-- Se der problema, rodar: rollback_rls_multi_tenant.sql
-- ============================================================
