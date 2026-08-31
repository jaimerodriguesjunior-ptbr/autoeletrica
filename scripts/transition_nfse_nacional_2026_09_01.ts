import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(rootDir, ".env.local") });

const TARGET_DATE = "2026-09-01";
const TIME_ZONE = "America/Sao_Paulo";
const companies = [
  {
    organizationId: "e7bc8193-a8e6-4f91-9e5a-972ec8800f79",
    name: "Kabroski Automotiva",
    expectedCurrentProvider: "toledo-equiplano",
  },
  {
    organizationId: "7b2d3a85-de90-4e57-adb7-91102c11094a",
    name: "NHT Centro Automotivo",
    expectedCurrentProvider: "guaira-ipm",
  },
  {
    organizationId: "a66bcf26-4389-420e-94bd-2605166c126d",
    name: "Rally Injeção Eletrônica",
    expectedCurrentProvider: "nfse-nacional",
  },
] as const;

function saoPauloDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getToken(baseUrl: string) {
  const clientId = process.env.NUVEMFISCAL_PROD_CLIENT_ID;
  const clientSecret = process.env.NUVEMFISCAL_PROD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais de produção da Nuvem Local Fiscal ausentes.");

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "empresa nfse",
    }),
  });
  if (!response.ok) throw new Error(`Falha de autenticação na Nuvem Local Fiscal (${response.status}).`);
  return (await response.json()).access_token as string;
}

async function main() {
  if (saoPauloDate() < TARGET_DATE) {
    throw new Error(`Execução bloqueada antes de ${TARGET_DATE} (${TIME_ZONE}).`);
  }

  const baseUrl = String(process.env.NUVEMFISCAL_PROD_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("URL de produção da Nuvem Local Fiscal ausente.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Acesso ao banco de dados ausente.");

  const token = await getToken(baseUrl);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("company_settings")
    .select("organization_id, cnpj, cpf_cnpj")
    .in("organization_id", companies.map((company) => company.organizationId));
  if (error) throw error;

  const records = new Map((data || []).map((company: any) => [company.organization_id, company]));
  const prepared = [] as { company: (typeof companies)[number]; cnpj: string; provider: string }[];

  // Preflight everything before making any production change.
  for (const company of companies) {
    const record = records.get(company.organizationId);
    const cnpj = String(record?.cnpj || record?.cpf_cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) throw new Error(`${company.name}: CNPJ ausente ou inválido.`);

    const response = await fetch(`${baseUrl}/empresas/${cnpj}/nfse?ambiente=producao`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`${company.name}: não foi possível consultar a NFS-e (${response.status}).`);
    const config = await response.json();
    const provider = String(config?.provedor || "");
    const allowedProviders = new Set([company.expectedCurrentProvider, "nfse-nacional"]);
    if (!allowedProviders.has(provider)) {
      throw new Error(`${company.name}: provedor inesperado (${provider || "vazio"}); nenhuma alteração aplicada.`);
    }
    if (!config?.nacional?.codigo_tributacao_nacional || !config?.nacional?.codigo_nbs) {
      throw new Error(`${company.name}: configuração nacional incompleta; nenhuma alteração aplicada.`);
    }
    prepared.push({ company, cnpj, provider });
  }

  for (const entry of prepared) {
    if (entry.provider === "nfse-nacional") {
      console.log(`${entry.company.name}: já utilizava nfse-nacional.`);
      continue;
    }

    const response = await fetch(`${baseUrl}/empresas/${entry.cnpj}/nfse`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // Deliberately partial: preserves the remote national configuration, RPS/DPS sequence and credentials.
      body: JSON.stringify({ ambiente: "producao", provedor: "nfse-nacional" }),
    });
    if (!response.ok) throw new Error(`${entry.company.name}: ativação recusada (${response.status}).`);

    const check = await fetch(`${baseUrl}/empresas/${entry.cnpj}/nfse?ambiente=producao`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const config = check.ok ? await check.json() : null;
    if (!check.ok || config?.provedor !== "nfse-nacional") {
      throw new Error(`${entry.company.name}: ativação não foi confirmada.`);
    }
    console.log(`${entry.company.name}: provedor nacional ativado e confirmado.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
