import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

function xmlTag(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]+)\\s*</${tag}>`, "i"))?.[1]?.trim() || null;
}

async function main() {
  const { data: company, error: companyError } = await supabase
    .from("company_settings")
    .select("organization_id, cnpj, cpf_cnpj, cidade, nfse_ambiente, ambiente_nfse, environment")
    .eq("organization_id", NHT)
    .maybeSingle();
  console.log("COMPANY_ERR", companyError?.message);
  console.log("COMPANY", company);

  const startDate = new Date(Date.UTC(2026, 7, 1)).toISOString();
  const endDate = new Date(Date.UTC(2026, 8, 1)).toISOString();

  const { data: rows, error } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, serie, status, environment, direction, tipo_documento, chave_acesso, valor_total, data_emissao, created_at, destinatario_nome, destinatario_cnpj, nuvemfiscal_uuid, xml_content, payload_json")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .or(`and(data_emissao.gte.${startDate},data_emissao.lt.${endDate}),and(data_emissao.is.null,created_at.gte.${startDate},created_at.lt.${endDate})`)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const all = rows || [];
  console.log("AUG_TOTAL", all.length);
  console.log("BY_STATUS_ENV", all.reduce((acc: any, r: any) => {
    const k = `${r.status}|${r.environment}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {}));

  const nacional = all.filter((r) => {
    const xml = String(r.xml_content || "");
    const key = String(r.chave_acesso || "");
    return xml.includes("sped.fazenda.gov") || key.length === 50 || key.startsWith("4108");
  });

  console.log("NACIONAL_COUNT", nacional.length);
  for (const r of nacional) {
    const xml = String(r.xml_content || "");
    const payload = r.payload_json || {};
    const inf = payload.infDPS || {};
    console.log("\n==== NACIONAL ====");
    console.log({
      id: r.id,
      numero: r.numero,
      serie: r.serie,
      status: r.status,
      environment: r.environment,
      valor: r.valor_total,
      data_emissao: r.data_emissao,
      created_at: r.created_at,
      destinatario: r.destinatario_nome,
      dest_doc: r.destinatario_cnpj,
      chave: r.chave_acesso,
      uuid: r.nuvemfiscal_uuid,
      payload_ambiente: payload.ambiente,
      tpAmb: inf.tpAmb || xmlTag(xml, "tpAmb"),
      dhEmi: inf.dhEmi,
      dCompet: inf.dCompet,
      nDPS: inf.nDPS,
      serieDps: inf.serie,
      cLocEmi: inf.cLocEmi || xmlTag(xml, "cLocEmi"),
      xml_tpAmb: xmlTag(xml, "tpAmb"),
      xml_amb: xmlTag(xml, "ambGer") || xmlTag(xml, "tpAmbGer"),
      xml_nNFSe: xmlTag(xml, "nNFSe") || xmlTag(xml, "nDPS"),
      xml_dhEmi: xmlTag(xml, "dhEmi") || xmlTag(xml, "dhProc"),
      xml_has_homolog: /homolog/i.test(xml),
      xml_snippet: xml.replace(/\s+/g, " ").slice(0, 400),
    });
  }

  const homolog = all.filter((r) => String(r.environment).toLowerCase().includes("homolog"));
  console.log("\nHOMOLOG_IN_AUGUST", homolog.map((r) => ({
    numero: r.numero,
    status: r.status,
    env: r.environment,
    chave: r.chave_acesso,
    data: r.data_emissao,
    valor: r.valor_total,
    nacional: String(r.xml_content || "").includes("sped.fazenda.gov"),
  })));

  const { data: sep } = await supabase
    .from("fiscal_invoices")
    .select("numero, status, environment, chave_acesso, data_emissao, created_at, xml_content")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .gte("data_emissao", "2026-09-01")
    .lt("data_emissao", "2026-09-15")
    .order("data_emissao", { ascending: true })
    .limit(15);
  console.log("\nSEP_SAMPLE", (sep || []).map((r) => ({
    n: r.numero,
    st: r.status,
    env: r.environment,
    d: r.data_emissao,
    chaveLen: String(r.chave_acesso || "").length,
    nacional: String(r.xml_content || "").includes("sped.fazenda.gov"),
    chave: String(r.chave_acesso || "").slice(0, 20),
  })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
