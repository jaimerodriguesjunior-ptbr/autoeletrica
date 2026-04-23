export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getAuthenticatedOwner() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (e) { }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, cargo')
    .eq('id', user.id)
    .single();

  if (!profile || profile.cargo !== 'owner') return null;

  return profile as { organization_id: string; cargo: string };
}

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedOwner();
    if (!caller) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { action, email, password, nome, cargo, user_id, comissao_percentual } = body;

    // --- AÇÃO 1: CRIAR NOVO USUÁRIO ---
    if (action === 'create') {
      if (!email || !password || !nome) {
        return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            organization_id: caller.organization_id, // sempre da sessão, nunca do body
            nome,
            email,
            cargo,
            comissao_percentual: comissao_percentual || 0,
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

      // Garante que o usuário alvo pertence à mesma organização
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('id', user_id)
        .single();

      if (targetProfile?.organization_id !== caller.organization_id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    // --- AÇÃO 3: ATUALIZAR PERFIL ---
    if (action === 'update_profile') {
      if (!user_id) {
        return NextResponse.json({ error: 'ID necessário' }, { status: 400 });
      }

      // Garante que o usuário alvo pertence à mesma organização
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('id', user_id)
        .single();

      if (targetProfile?.organization_id !== caller.organization_id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      }

      const updates: Record<string, unknown> = {};
      if (nome) updates.nome = nome;
      if (cargo) updates.cargo = cargo;
      if (comissao_percentual !== undefined) updates.comissao_percentual = comissao_percentual;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', user_id);

      if (profileError) throw profileError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error("Erro API Admin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}