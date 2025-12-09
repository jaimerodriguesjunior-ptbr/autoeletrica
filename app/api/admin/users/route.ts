import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente ADMIN (Bypass de regras)
// Só funciona se a chave SUPABASE_SERVICE_ROLE_KEY estiver no .env.local
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, nome, cargo, organization_id, user_id } = body;

    // --- AÇÃO 1: CRIAR NOVO USUÁRIO ---
    if (action === 'create') {
      if (!email || !password || !nome) {
        return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
      }

      // 1. Cria no sistema de Autenticação (Auth)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Já confirma o email automaticamente
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Cria o Perfil na tabela pública (Profiles)
        // O "upsert" garante que se já existir, ele atualiza
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            organization_id,
            nome,
            email,
            cargo,
            ativo: true
          });

        if (profileError) throw profileError;
      }

      return NextResponse.json({ success: true });
    }

    // --- AÇÃO 2: ALTERAR SENHA (RESET) ---
    if (action === 'update_password') {
      if (!user_id || !password) {
        return NextResponse.json({ error: 'ID e Senha necessários' }, { status: 400 });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: password }
      );

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro API Admin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}