-- ============================================================
-- SCRIPT DE CORREÇÃO: Limpeza Definitiva RLS da Tabela Profiles
-- ============================================================
-- Esse script resolve o problema do "Admin Rally" ver os 
-- funcionários do Norberto. O problema ocorre porque existe
-- alguma política antiga (ex: "Enable read access for all users")
-- que permaneceu na tabela profiles e está liberando a leitura.
-- ============================================================

-- 1. Desabilitar RLS temporariamente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Derrubar TODAS as políticas existentes na tabela profiles
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Habilitar RLS novamente
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Recriar SÓ as políticas cegas / multi-tenant estritas:

-- A) O usuário pode ver seu próprio perfil sempre
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = auth.uid());

-- B) O usuário pode ver os perfis DENTRO da sua organização
CREATE POLICY "profiles_select_org" ON profiles
    FOR SELECT USING (organization_id = get_my_organization_id());

-- C) O usuário pode atualizar seu próprio perfil
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- D) Quem insere é o service_role (Admin), então não precisamos
--    de política de INSERT para o client.

-- ============================================================
-- PRONTO! Execute isso no SQL Editor do Supabase.
-- ============================================================
