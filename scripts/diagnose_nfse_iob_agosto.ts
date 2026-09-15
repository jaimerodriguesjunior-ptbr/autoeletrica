import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function summarize(inv: any) {
  const payload = inv.payload_json || {};
  const infDps = payload.infDPS || {};
  const chave = String(inv.chave_acesso || "");
  const chaveDigits = digits(chave);
  return {
    numero: inv.numero,
    status: inv.status,
    env: inv.environment,
    data: inv.data_emissao,
    created: inv.created_at,
    chave: chave,
    chaveLen: chave.length,
    chaveDigitsLen: chaveDigits.length,
    cityFromChave: chaveDigits.slice(0, 4) || "(empty)",
    hasInfDPS: Boolean(payload.infDPS),
    payloadKeys: Object.keys(payload).slice(0, 12),
    cTribNac: infDps.serv?.cServ?.cTribNac,
    cTribMun: infDps.serv?.cServ?.cTribMun,
    pAliq: infDps.valores?.trib?.tribMun?.pAliq,
    vServ: infDps.valores?.vServPrest?.vServ ?? inv.valor_total,
    dCompet: infDps.dCompet,
    dhEmi: infDps.dhEmi,
    tomaDoc: infDps.toma?.CNPJ || infDps.toma?.CPF || inv.destinatario_cnpj,
    xmlPrefix: String(inv.xml_content || "").slice(0, 80).replace(/\s+/g, " "),
  };
}

async function loadMonth(month: number, year: number) {
  const startDate = new Date(Date.UTC(year, month, 1)).toISOString();
  const endDate = new Date(Date.UTC(year, month + 1, 1)).toISOString();
  const { data, error } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, serie, chave_acesso, valor_total, data_emissao, created_at, status, environment, destinatario_cnpj, payload_json, xml_content")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .eq("direction", "output")
    .or(`and(data_emissao.gte.${startDate},data_emissao.lt.${endDate}),and(data_emissao.is.null,created_at.gte.${startDate},created_at.lt.${endDate})`)
    .order("data_emissao", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

async function main() {
  const { data: company } = await supabase
    .from("company_settings")
    .select("cnpj, cpf_cnpj, cidade, uf, cep, nfse_provider, codigo_municipio_ibge")
    .eq("organization_id", NHT)
    .single();
  console.log("COMPANY", company);

  for (const [label, month] of [["JUL", 6], ["AGO", 7]] as const) {
    const rows = await loadMonth(month, 2026);
    const authorized = rows.filter((r) => r.status === "authorized" && r.environment !== "homologation");
    const cityCounts: Record<string, number> = {};
    const chaveLens: Record<string, number> = {};
    const hasDps = { yes: 0, no: 0 };
    for (const r of authorized) {
      const s = summarize(r);
      cityCounts[s.cityFromChave] = (cityCounts[s.cityFromChave] || 0) + 1;
      chaveLens[String(s.chaveLen)] = (chaveLens[String(s.chaveLen)] || 0) + 1;
      if (s.hasInfDPS) hasDps.yes++; else hasDps.no++;
    }
    console.log("\n====", label, "====");
    console.log("total rows", rows.length, "authorized prod", authorized.length);
    console.log("status", rows.reduce((a: any, r: any) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}));
    console.log("env", rows.reduce((a: any, r: any) => { a[r.environment] = (a[r.environment] || 0) + 1; return a; }, {}));
    console.log("cityFromChave", cityCounts);
    console.log("chaveLen", chaveLens);
    console.log("hasInfDPS", hasDps);
    const first = authorized[0] && summarize(authorized[0]);
    const last = authorized[authorized.length - 1] && summarize(authorized[authorized.length - 1]);
    const odd = authorized.map(summarize).filter((s) => s.cityFromChave !== "7571" || !s.hasInfDPS || s.chaveLen < 20);
    console.log("first", first);
    console.log("last", last);
    console.log("odd count", odd.length);
    console.log("odd sample", odd.slice(0, 8));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
