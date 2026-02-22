-- ============================================================
-- SCRIPT DE ROLLBACK: Remover TUDO e voltar ao estado anterior
-- Data: 2026-02-21 (v2 - inclui remoção da função)
--
-- QUANDO USAR: Se o sistema apresentar problemas após aplicar
-- o migration_rls_multi_tenant.sql
-- ============================================================

-- 1. REMOVER TODAS AS POLÍTICAS

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_org" ON profiles;

-- organizations
DROP POLICY IF EXISTS "org_select_own" ON organizations;

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

-- 2. DESABILITAR RLS EM TODAS AS TABELAS

ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- 3. REMOVER A FUNÇÃO AUXILIAR

DROP FUNCTION IF EXISTS get_my_organization_id();

-- ============================================================
-- ROLLBACK CONCLUÍDO!
-- O sistema voltou ao estado anterior (sem RLS).
-- ============================================================
