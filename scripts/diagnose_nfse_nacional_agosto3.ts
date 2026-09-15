import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";
const WOS = [773, 935, 807, 205];

async function main() {
  const { data: invoices, error } = await supabase
    .from("fiscal_invoices")
    .select("id, work_order_id, numero, status, environment, tipo_documento, chave_acesso, valor_total, data_emissao, created_at, destinatario_nome, error_message")
    .eq("organization_id", NHT)
    .in("work_order_id", WOS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  console.log("INVOICES_FOR_WOS", invoices);

  const { data: wos } = await supabase
    .from("work_orders")
    .select("id, numero, status, total, created_at")
    .in("id", WOS);
  console.log("WOS", wos);

  const { data: augErrors } = await supabase
    .from("fiscal_invoices")
    .select("numero, status, environment, valor_total, data_emissao, destinatario_nome, error_message, chave_acesso")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .gte("created_at", "2026-08-01")
    .lt("created_at", "2026-09-01")
    .eq("status", "error");
  console.log("AUG_ERRORS", (augErrors || []).map((r) => ({
    n: r.numero,
    env: r.environment,
    v: r.valor_total,
    d: r.data_emissao,
    dest: r.destinatario_nome,
    chave: String(r.chave_acesso || "").slice(0, 20),
    err: String(r.error_message || "").slice(0, 180),
  })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
