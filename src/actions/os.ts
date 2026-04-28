"use server";

import { createClient } from "@/src/utils/supabase/server";

export async function reopenOS(osId: string, pin: string) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "Não autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, cargo")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) return { success: false, error: "Organização não encontrada." };

  const cargo = profile.cargo?.toLowerCase();
  if (cargo !== "owner" && cargo !== "gerente" && cargo !== "admin") {
    return { success: false, error: "Apenas administradores podem reabrir uma OS." };
  }

  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("manager_pin")
    .eq("organization_id", profile.organization_id)
    .single();

  if (!companySettings?.manager_pin) {
    return {
      success: false,
      error: "PIN de gerência não configurado. Configure em Configurações > Opções de Uso.",
    };
  }

  if (pin !== companySettings.manager_pin) {
    return { success: false, error: "PIN incorreto." };
  }

  const { data: paidCommissions } = await supabase
    .from("commissions")
    .select("id")
    .eq("work_order_id", osId)
    .eq("status", "paid")
    .limit(1);

  if (paidCommissions && paidCommissions.length > 0) {
    return {
      success: false,
      error:
        "Não é possível reabrir esta OS: há comissões já pagas aos funcionários. Realize os ajustes manualmente.",
    };
  }

  await supabase
    .from("commissions")
    .delete()
    .eq("work_order_id", osId)
    .eq("status", "pending");

  await supabase
    .from("transactions")
    .delete()
    .eq("work_order_id", osId)
    .eq("category", "Serviços");

  const { error: updateError } = await supabase
    .from("work_orders")
    .update({ status: "pronto" })
    .eq("id", osId);

  if (updateError) return { success: false, error: "Erro ao reabrir OS: " + updateError.message };

  return { success: true };
}
