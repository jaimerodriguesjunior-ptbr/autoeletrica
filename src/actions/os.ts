"use server";

import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";

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

  const supabaseAdmin = createAdminClient();

  const { data: workOrder, error: workOrderError } = await supabaseAdmin
    .from("work_orders")
    .select("id, organization_id, total, work_order_items(total_price, peca_cliente)")
    .eq("id", osId)
    .single();

  if (workOrderError || !workOrder || workOrder.organization_id !== profile.organization_id) {
    return { success: false, error: "OS não encontrada nesta organização." };
  }

  const { data: paidCommissions, error: paidCommissionsError } = await supabaseAdmin
    .from("commissions")
    .select("id")
    .eq("work_order_id", osId)
    .eq("status", "paid")
    .limit(1);

  if (paidCommissionsError) {
    return { success: false, error: "Erro ao verificar comissões: " + paidCommissionsError.message };
  }

  if (paidCommissions && paidCommissions.length > 0) {
    return {
      success: false,
      error:
        "Não é possível reabrir esta OS: há comissões já pagas aos funcionários. Realize os ajustes manualmente.",
    };
  }

  const { error: commissionError } = await supabaseAdmin
    .from("commissions")
    .delete()
    .eq("work_order_id", osId)
    .eq("status", "pending");

  if (commissionError) {
    return { success: false, error: "Erro ao remover comissões pendentes: " + commissionError.message };
  }

  const totalItensBruto = (workOrder.work_order_items || []).reduce(
    (total: number, item: { total_price: number | null; peca_cliente: boolean | null }) =>
      item.peca_cliente ? total : total + Number(item.total_price || 0),
    0
  );
  const totalBruto = totalItensBruto > 0 ? totalItensBruto : Number(workOrder.total || 0);

  const { error: updateError } = await supabaseAdmin
    .from("work_orders")
    .update({ status: "pronto", total: totalBruto })
    .eq("id", osId);

  if (updateError) return { success: false, error: "Erro ao reabrir OS: " + updateError.message };

  return { success: true };
}
