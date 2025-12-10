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

    return { success: true, data: profile }
    
  } catch (error) {
    console.error("Erro técnico:", error)
    return { success: false, data: null }
  }
}