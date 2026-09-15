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
    .select("id, numero, status, environment, valor_total, data_emissao, created_at, chave_acesso, destinatario_nome")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .eq("direction", "output")
    .neq("environment", "homologation")
    .or("and(data_emissao.gte.2026-08-01T00:00:00.000Z,data_emissao.lt.2026-09-01T00:00:00.000Z),and(data_emissao.is.null,created_at.gte.2026-08-01T00:00:00.000Z,created_at.lt.2026-09-01T00:00:00.000Z)")
    .order("data_emissao", { ascending: true });
  if (error) throw error;

  const rows = data || [];
  const authorized = rows.filter((r) => r.status === "authorized");
  const errors = rows.filter((r) => r.status === "error");
  const sum = (list: typeof rows) => list.reduce((t, r) => t + Number(r.valor_total || 0), 0);

  console.log(JSON.stringify({
    totalRows: rows.length,
    authorizedCount: authorized.length,
    authorizedSum: sum(authorized),
    errorCount: errors.length,
    errorSum: sum(errors),
    zipWouldShow: sum(authorized).toFixed(2),
    authorized: authorized.map((r) => ({
      n: r.numero,
      v: Number(r.valor_total),
      d: r.data_emissao,
      dest: r.destinatario_nome,
    })),
    errorsMarked: errors.map((r) => ({
      n: r.numero,
      v: Number(r.valor_total),
      st: r.status,
      dest: r.destinatario_nome,
    })),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
