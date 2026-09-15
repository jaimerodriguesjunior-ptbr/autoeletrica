import { promises as fs } from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { buildNfseAccountingExport } from "@/src/lib/accounting-nfse-export";

dotenv.config({ path: ".env.local" });

const organizationId = "7b2d3a85-de90-4e57-adb7-91102c11094a";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const result = await buildNfseAccountingExport(supabase as any, organizationId, 7, 2026);
  if (!result) throw new Error("Nenhuma NFS-e IPM de agosto para exportar.");

  const output = path.resolve(process.cwd(), result.fileName);
  await fs.writeFile(output, result.content);
  console.log(JSON.stringify({ output, invoiceCount: result.invoiceCount, fileName: result.fileName, bytes: result.content.length }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
