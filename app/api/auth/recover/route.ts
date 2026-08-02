import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL nao configuradas');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'Informe o e-mail.' }, { status: 400 });
    }

    // 1. Busca o perfil para ver o cargo (Admin consegue ler tudo)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('cargo')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    // Se não achar o perfil, finge que enviou (segurança) ou avisa erro. 
    // Para sistema interno, avisar é melhor.
    if (!profile) {
      return NextResponse.json({ type: 'error', message: 'E-mail não encontrado na base de funcionários.' });
    }

    // 2. LÓGICA DE DECISÃO
    if (profile.cargo === 'owner') {
      // É GERENTE: Envia o e-mail de verdade
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${new URL(req.url).origin}/update-password`, // Página futura se necessário, ou dashboard
      });

      if (resetError) throw resetError;

      return NextResponse.json({ 
        type: 'success', 
        message: 'E-mail de recuperação enviado! Verifique sua caixa de entrada.' 
      });

    } else {
      // É FUNCIONÁRIO: Manda procurar o gerente
      return NextResponse.json({ 
        type: 'info', 
        message: 'Por segurança, contas de colaboradores são geridas pela empresa. Solicite a troca de senha ao seu gerente.' 
      });
    }

  } catch (error: any) {
    console.error("Erro Recover:", error);
    if (String(error?.message || '').includes('SUPABASE_SERVICE_ROLE_KEY') || String(error?.message || '').includes('NEXT_PUBLIC_SUPABASE_URL')) {
      return NextResponse.json({ type: 'error', message: 'Configuracao do Supabase ausente no ambiente.' }, { status: 500 });
    }
    return NextResponse.json({ type: 'error', message: 'Erro interno ao processar pedido.' }, { status: 500 });
  }
}
