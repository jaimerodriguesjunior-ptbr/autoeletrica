'use server'

// CORREÇÃO: Usando caminho relativo (../) para garantir que o VS Code encontre
import { createAdminClient } from '../utils/supabase/admin'
import { createClient } from '../utils/supabase/server'
import { cookies } from 'next/headers'

export async function getProfileServerAction() {
  // Cria o cliente padrão para ver quem está logado
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, data: null }
  }

  // Agora usa o ADMIN CLIENT para buscar os dados sem travas
  const supabaseAdmin = createAdminClient()

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error("Erro ao buscar perfil (Admin):", error)
      return { success: false, data: null }
    }

    // Busca configurações da empresa (se houver) para gerenciar módulos
    let usa_fiscal = true;
    let usa_caixa = true;
    let nome_fantasia = "";
    let logo_url = "";

    if (profile.organization_id) {
      const { data: company } = await supabaseAdmin
        .from('company_settings')
        .select('usa_fiscal, usa_caixa, nome_fantasia, logo_url')
        .eq('organization_id', profile.organization_id)
        .single()

      if (company) {
        usa_fiscal = company.usa_fiscal !== undefined ? company.usa_fiscal : true;
        usa_caixa = company.usa_caixa !== undefined ? company.usa_caixa : true;
        nome_fantasia = company.nome_fantasia || "";
        logo_url = company.logo_url || "";
      }
    }

    return {
      success: true,
      data: {
        ...profile,
        usa_fiscal,
        usa_caixa,
        nome_fantasia,
        logo_url
      }
    }

  } catch (error) {
    console.error("Erro técnico:", error)
    return { success: false, data: null }
  }
}