import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

function monthOf(iso: string | null, tz = "UTC") {
  if (!iso) return null;
  const d = new Date(iso);
  if (tz === "BRT") {
    const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function cfops(xml: string) {
  const found = [...xml.matchAll(/<CFOP>([^<]+)<\/CFOP>/gi)].map((m) => m[1].trim());
  return [...new Set(found)];
}

async function main() {
  const { data, error } = await supabase
    .from("fiscal_invoices")
    .select("id, numero, serie, status, environment, valor_total, data_emissao, created_at, chave_acesso, destinatario_nome, xml_content, payload_json")
    .eq("organization_id", NHT)
    .eq("direction", "entry")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data || []).map((r) => {
    const xml = String(r.xml_content || "");
    const dhEmi = xml.match(/<dhEmi>([^<]+)<\/dhEmi>/)?.[1] || xml.match(/<dEmi>([^<]+)<\/dEmi>/)?.[1] || null;
    return {
      id: r.id,
      numero: r.numero,
      status: r.status,
      env: r.environment,
      valor: Number(r.valor_total || 0),
      data_emissao: r.data_emissao,
      created_at: r.created_at,
      emitMonth: monthOf(r.data_emissao),
      importMonth: monthOf(r.created_at),
      xmlMonth: monthOf(dhEmi),
      chave: String(r.chave_acesso || ""),
      nome: r.destinatario_nome,
      cfop: cfops(xml),
    };
  });

  const sum = (list: typeof rows) => Number(list.reduce((t, r) => t + r.valor, 0).toFixed(2));
  const notCancel = rows.filter((r) => r.status !== "cancelled" && r.env !== "homologation");

  const importedAug = notCancel.filter((r) => r.importMonth === "2026-08");
  const issuedAug = notCancel.filter((r) => r.emitMonth === "2026-08" || (!r.emitMonth && r.importMonth === "2026-08"));
  const issuedAugOnly = notCancel.filter((r) => r.emitMonth === "2026-08");
  const importedAugIssuedOther = importedAug.filter((r) => r.emitMonth && r.emitMonth !== "2026-08");
  const issuedAugImportedOther = issuedAugOnly.filter((r) => r.importMonth !== "2026-08");

  console.log(JSON.stringify({
    all: { qtd: rows.length, sum: sum(rows) },
    notCancel: { qtd: notCancel.length, sum: sum(notCancel) },
    importedAug: { qtd: importedAug.length, sum: sum(importedAug) },
    issuedAugZipRule: { qtd: issuedAug.length, sum: sum(issuedAug) },
    issuedAugOnly: { qtd: issuedAugOnly.length, sum: sum(issuedAugOnly) },
    importedAugIssuedOther: {
      qtd: importedAugIssuedOther.length,
      sum: sum(importedAugIssuedOther),
      byMonth: importedAugIssuedOther.reduce((a: any, r) => {
        a[r.emitMonth!] = Number(((a[r.emitMonth!] || 0) + r.valor).toFixed(2));
        return a;
      }, {}),
      notes: importedAugIssuedOther.map((r) => ({ n: r.numero, v: r.valor, emit: r.data_emissao, imp: r.created_at, cfop: r.cfop, nome: r.nome })),
    },
    issuedAugImportedOther: {
      qtd: issuedAugImportedOther.length,
      sum: sum(issuedAugImportedOther),
      notes: issuedAugImportedOther.map((r) => ({ n: r.numero, v: r.valor, emit: r.data_emissao, imp: r.created_at, cfop: r.cfop, nome: r.nome })),
    },
    issuedAugByCfop: issuedAug.reduce((a: any, r) => {
      const key = r.cfop.join(",") || "sem";
      a[key] = Number(((a[key] || 0) + r.valor).toFixed(2));
      return a;
    }, {}),
    issuedAugNotes: issuedAug.map((r) => ({ n: r.numero, v: r.valor, emit: r.data_emissao, cfop: r.cfop, st: r.status, nome: r.nome })),
    diffImportVsP9: Number((sum(importedAug) - 6284.09).toFixed(2)),
    diffIssueVsP9: Number((sum(issuedAug) - 6284.09).toFixed(2)),
    remainingIf1555: Number((sum(issuedAug) - 6284.09).toFixed(2)),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
