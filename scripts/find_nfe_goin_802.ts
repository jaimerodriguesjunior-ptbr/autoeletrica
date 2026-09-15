import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

async function main() {
  const { data: byNumero, error } = await supabase
    .from("fiscal_invoices")
    .select("id, organization_id, numero, serie, status, environment, direction, valor_total, data_emissao, created_at, chave_acesso, destinatario_nome, xml_content")
    .eq("organization_id", NHT)
    .eq("numero", "802");
  if (error) throw error;

  const { data: byValue } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, serie, status, direction, valor_total, data_emissao, created_at, chave_acesso, destinatario_nome")
    .eq("organization_id", NHT)
    .eq("direction", "entry")
    .gte("valor_total", 1554.99)
    .lte("valor_total", 1555.01);

  const { data: going } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, serie, status, direction, valor_total, data_emissao, created_at, chave_acesso, destinatario_nome, xml_content")
    .eq("organization_id", NHT)
    .eq("direction", "entry")
    .or("destinatario_nome.ilike.%goin%,xml_content.ilike.%GOIN CAR%,xml_content.ilike.%0919503%");

  const { data: around } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, serie, status, direction, valor_total, data_emissao, created_at, chave_acesso")
    .eq("organization_id", NHT)
    .eq("direction", "entry")
    .gte("data_emissao", "2026-08-26T00:00:00.000Z")
    .lt("data_emissao", "2026-08-27T00:00:00.000Z");

  const summarize = (rows: any[] | null) =>
    (rows || []).map((r) => ({
      id: r.id,
      n: r.numero,
      s: r.serie,
      st: r.status,
      dir: r.direction,
      v: r.valor_total,
      emit: r.data_emissao,
      imp: r.created_at,
      chave: r.chave_acesso,
      nome: r.destinatario_nome,
      hasXml: Boolean(r.xml_content),
      xmlHasGoin: String(r.xml_content || "").toUpperCase().includes("GOIN"),
    }));

  console.log(JSON.stringify({
    byNumero802: summarize(byNumero),
    byValue1555: summarize(byValue),
    goinHits: summarize(going),
    issuedAug26: summarize(around),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
