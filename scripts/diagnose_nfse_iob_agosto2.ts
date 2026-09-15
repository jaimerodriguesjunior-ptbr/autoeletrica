import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}[^>]*>\\s*([^<]+)\\s*</${name}>`, "i"));
  return match?.[1]?.trim() || null;
}

function attrs(xml: string) {
  return {
    encoding: xml.match(/encoding="([^"]+)"/i)?.[1],
    root: xml.match(/<(nfse|NFSe|retorno|NFS-e|CompNfse)[\s>]/)?.[1],
    numero_nfse: tag(xml, "numero_nfse") || tag(xml, "nNFSe") || tag(xml, "Numero"),
    codigo_verificacao: tag(xml, "codigo_verificacao") || tag(xml, "cod_verificacao") || tag(xml, "codigo_autenticacao"),
    codauten: xml.match(/codauten=([0-9A-Za-z]+)/i)?.[1] || null,
    cidade: tag(xml, "cidade") || tag(xml, "cLocEmi") || tag(xml, "cMun"),
    cnpj: tag(xml, "cpfcnpj") || tag(xml, "CNPJ"),
    infNFSe: Boolean(xml.includes("infNFSe") || xml.includes("infDPS")),
    nacional: xml.includes("sped.fazenda.gov"),
    ipm: xml.includes("<retorno>") || xml.includes("nfs-e.net"),
    snippet: xml.replace(/\s+/g, " ").slice(0, 280),
  };
}

async function main() {
  const startDate = new Date(Date.UTC(2026, 7, 1)).toISOString();
  const endDate = new Date(Date.UTC(2026, 8, 1)).toISOString();
  const { data, error } = await supabase
    .from("fiscal_invoices")
    .select("numero, chave_acesso, xml_content, xml_url, status, environment, valor_total, data_emissao, payload_json")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .eq("direction", "output")
    .eq("status", "authorized")
    .neq("environment", "homologation")
    .or(`and(data_emissao.gte.${startDate},data_emissao.lt.${endDate}),and(data_emissao.is.null,created_at.gte.${startDate},created_at.lt.${endDate})`)
    .order("data_emissao", { ascending: true });
  if (error) throw error;

  const rows = data || [];
  console.log("count", rows.length);
  const samples = [
    rows.find((r) => String(r.chave_acesso).length === 3),
    rows.find((r) => String(r.chave_acesso).length === 50),
    rows[rows.length - 1],
  ];
  for (const r of samples) {
    if (!r) continue;
    const xml = String(r.xml_content || "");
    console.log("\nSAMPLE numero", r.numero, "chave", r.chave_acesso, "xmlLen", xml.length, "url", r.xml_url);
    console.log(attrs(xml));
    const inf = r.payload_json?.infDPS || {};
    console.log("payload nDPS", inf.nDPS, "serie", inf.serie, "dhEmi", inf.dhEmi);
  }

  const nacional = rows.filter((r) => String(r.xml_content || "").includes("sped.fazenda.gov") || String(r.chave_acesso).length === 50);
  const ipm = rows.filter((r) => !nacional.includes(r));
  console.log("\nNACIONAL", nacional.map((r) => ({ n: r.numero, chave: r.chave_acesso, v: r.valor_total, d: r.data_emissao })));
  console.log("IPM count", ipm.length, "NACIONAL count", nacional.length);

  const verif = ipm.map((r) => attrs(String(r.xml_content || "")).codigo_verificacao || attrs(String(r.xml_content || "")).codauten);
  const verifLens: Record<string, number> = {};
  for (const v of verif) verifLens[v ? String(v).length : "null"] = (verifLens[v ? String(v).length : "null"] || 0) + 1;
  console.log("ipm verification lens", verifLens);
  console.log("ipm verification sample", verif.slice(0, 5));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
