import { promises as fs } from "node:fs";
import * as dotenv from "dotenv";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildFiscalReportData } from "@/app/api/closing/zip/route";
import { buildClosingZip, type ClosingData } from "@/src/lib/closing-zip";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const organizationId = "7b2d3a85-de90-4e57-adb7-91102c11094a";
const month = 7;
const year = 2026;

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase.rpc("get_monthly_closing_data", {
    p_organization_id: organizationId,
    p_month: month,
    p_year: year,
  });
  if (error || !data) throw error || new Error("Fechamento mensal não encontrado.");

  const fiscalData = await buildFiscalReportData(
    supabase as any,
    organizationId,
    month,
    year,
    data as ClosingData,
  );
  const { blob } = await buildClosingZip(supabase as any, organizationId, month - 1, year, fiscalData);
  const output = path.resolve(process.cwd(), "Fechamento_Julho_2026_CORRIGIDO.zip");
  await fs.writeFile(output, Buffer.from(await blob.arrayBuffer()));
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
