import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

async function main() {
  const { data, error } = await supabase
    .from("fiscal_invoices")
    .select("numero, status, valor_total, data_emissao, created_at, chave_acesso, xml_content")
    .eq("organization_id", NHT)
    .eq("direction", "entry");
  if (error) throw error;

  const hits = (data || []).filter((r) => {
    const v = Number(r.valor_total || 0);
    return Math.abs(v - 1555) < 0.02 || Math.abs(v - 1555.00) < 0.02;
  });
  console.log("EXACT_1555", hits.map((r) => ({
    n: r.numero,
    v: r.valor_total,
    st: r.status,
    emit: r.data_emissao,
    imp: r.created_at,
  })));

  const augXml = (data || []).filter((r) => /<dhEmi>2026-08/.test(String(r.xml_content || "")) || /<dEmi>08\/08\/2026|\/08\/2026/.test(String(r.xml_content || "")));
  console.log("XML_AUG_COUNT", augXml.length);

  const cancelledAug = (data || []).filter((r) => r.status === "cancelled" && String(r.data_emissao || "").startsWith("2026-08"));
  console.log("CANCELLED_AUG", cancelledAug.map((r) => ({ n: r.numero, v: r.valor_total })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
