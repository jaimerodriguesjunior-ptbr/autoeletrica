import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";
const FALSE_POSITIVE_IDS = [
  "30df09ed-2391-40bd-b2fa-d9aa4bad9c51",
  "33d5eeec-6ecb-4bf9-a513-c68465cf7184",
  "4a1d89f7-c61a-4b46-8635-23088fb3a87f",
] as const;

const ERROR_MESSAGE =
  "NFSE_NACIONAL_RECOVERY_MISMATCH: XML nacional de teste da SEFIN (competencia 03/02/2026, tomador Jaime Rodrigues Junior) foi associado por engano a uma OS de agosto/2026. A nota nao foi emitida neste pedido e nao deve entrar no fechamento. Historico preservado; status corrigido em 14/09/2026.";

function xmlTag(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]*)\\s*</${tag}>`, "i"))?.[1]?.trim() || "";
}

async function main() {
  const apply = process.argv.includes("--apply");

  const { data: rows, error } = await supabase
    .from("fiscal_invoices")
    .select("id, organization_id, work_order_id, numero, serie, status, environment, tipo_documento, chave_acesso, valor_total, data_emissao, created_at, destinatario_nome, destinatario_cnpj, xml_content, payload_json, nuvemfiscal_uuid")
    .in("id", [...FALSE_POSITIVE_IDS]);
  if (error) throw error;

  if ((rows || []).length !== 3) {
    throw new Error(`Esperava 3 notas, encontrei ${(rows || []).length}`);
  }

  for (const row of rows || []) {
    if (row.organization_id !== NHT) throw new Error(`Org inesperada em ${row.id}`);
    if (row.status !== "authorized") throw new Error(`Status inesperado em ${row.id}: ${row.status}`);
    if (row.environment !== "production") throw new Error(`Ambiente inesperado em ${row.id}: ${row.environment}`);
    const xml = String(row.xml_content || "");
    const dCompet = xmlTag(xml, "dCompet");
    const tomaCpf = xmlTag(xml, "CPF");
    const vServ = xmlTag(xml, "vServ");
    if (dCompet !== "2026-02-03") throw new Error(`XML de ${row.id} nao e o teste de 03/02 (${dCompet})`);
    if (tomaCpf !== "58212043134") throw new Error(`Tomador do XML de ${row.id} nao e o teste (${tomaCpf})`);
    console.log("OK_MATCH", {
      id: row.id,
      numero: row.numero,
      wo: row.work_order_id,
      dest: row.destinatario_nome,
      valor_os: row.valor_total,
      xml_dCompet: dCompet,
      xml_vServ: vServ,
      xml_cpf: tomaCpf,
      chave: row.chave_acesso,
    });
  }

  const woIds = [...new Set((rows || []).map((r) => r.work_order_id).filter(Boolean))];
  const { data: related } = await supabase
    .from("fiscal_invoices")
    .select("id, work_order_id, numero, status, environment, chave_acesso, valor_total, data_emissao, destinatario_nome")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .in("work_order_id", woIds);
  console.log("RELATED_FOR_OS", related);

  const { data: woRows, error: woError } = await supabase
    .from("work_orders")
    .select("id, numero, status")
    .in("id", woIds);
  console.log("WORK_ORDERS", woError?.message || woRows);

  if (!apply) {
    console.log("DRY_RUN: rode com --apply para gravar o status error.");
    return;
  }

  for (const row of rows || []) {
    const { error: updateError } = await supabase
      .from("fiscal_invoices")
      .update({
        status: "error",
        error_message: ERROR_MESSAGE,
      })
      .eq("id", row.id)
      .eq("organization_id", NHT)
      .eq("status", "authorized");
    if (updateError) throw updateError;
  }

  const { data: after } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, status, error_message, chave_acesso, xml_content")
    .in("id", [...FALSE_POSITIVE_IDS]);
  console.log("AFTER", (after || []).map((r) => ({
    id: r.id,
    numero: r.numero,
    status: r.status,
    hasXml: Boolean(r.xml_content),
    chave: r.chave_acesso,
    err: String(r.error_message || "").slice(0, 80),
  })));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
