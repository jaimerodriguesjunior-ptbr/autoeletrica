import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";
const IDS = [
  "30df09ed-2391-40bd-b2fa-d9aa4bad9c51",
  "33d5eeec-6ecb-4bf9-a513-c68465cf7184",
  "4a1d89f7-c61a-4b46-8635-23088fb3a87f",
  "fd191b1d-aed8-4c73-9b9f-414c114dfa82",
];

function allTags(xml: string, tags: string[]) {
  const out: Record<string, string | null> = {};
  for (const tag of tags) {
    const matches = [...xml.matchAll(new RegExp(`<${tag}[^>]*>\\s*([^<]*)\\s*</${tag}>`, "gi"))];
    out[tag] = matches.map((m) => m[1].trim()).filter(Boolean).slice(0, 6).join(" | ") || null;
  }
  return out;
}

async function main() {
  const { data, error } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, status, environment, error_message, data_emissao, created_at, chave_acesso, valor_total, destinatario_nome, xml_content, payload_json, nuvemfiscal_uuid, work_order_id")
    .in("id", IDS);
  if (error) throw error;

  for (const r of data || []) {
    const xml = String(r.xml_content || "");
    console.log("\n==========", r.numero, r.id, "==========");
    console.log({
      status: r.status,
      env: r.environment,
      error: r.error_message,
      data_emissao: r.data_emissao,
      created_at: r.created_at,
      valor: r.valor_total,
      dest: r.destinatario_nome,
      wo: r.work_order_id,
      uuid: r.nuvemfiscal_uuid,
    });
    console.log("XML_TAGS", allTags(xml, [
      "nNFSe", "nDPS", "dhEmi", "dhProc", "dCompet", "tpAmb", "ambGer",
      "xNome", "CNPJ", "CPF", "vServ", "vLiq", "cTribNac", "xDescServ", "cStat", "xMotivo",
    ]));
    const inf = r.payload_json?.infDPS || {};
    console.log("PAYLOAD", {
      ambiente: r.payload_json?.ambiente,
      tpAmb: inf.tpAmb,
      dhEmi: inf.dhEmi,
      dCompet: inf.dCompet,
      vServ: inf.valores?.vServPrest?.vServ,
      toma: inf.toma?.xNome,
      tomaDoc: inf.toma?.CNPJ || inf.toma?.CPF,
      desc: inf.serv?.cServ?.xDescServ,
    });
  }

  const { data: feb } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, status, environment, chave_acesso, data_emissao, created_at, valor_total, destinatario_nome, xml_content")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .or("data_emissao.gte.2026-02-01,created_at.gte.2026-02-01")
    .lt("created_at", "2026-03-01")
    .order("created_at", { ascending: true });
  console.log("\nFEB_COUNT", feb?.length);
  console.log("FEB", (feb || []).map((r) => ({
    n: r.numero,
    st: r.status,
    env: r.environment,
    d: r.data_emissao,
    c: r.created_at,
    v: r.valor_total,
    dest: r.destinatario_nome,
    chave: String(r.chave_acesso || "").slice(0, 24),
    nacional: String(r.xml_content || "").includes("sped.fazenda.gov"),
  })));

  const { data: lowNums } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, status, environment, chave_acesso, data_emissao, created_at, valor_total, destinatario_nome")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .in("numero", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  console.log("\nLOW_NUMBERS", (lowNums || []).map((r) => ({
    n: r.numero,
    st: r.status,
    env: r.environment,
    d: r.data_emissao,
    c: r.created_at,
    v: r.valor_total,
    dest: r.destinatario_nome,
    chave: String(r.chave_acesso || "").slice(0, 30),
  })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
