import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const NHT = "7b2d3a85-de90-4e57-adb7-91102c11094a";

async function main() {
  const { data: ago, error } = await supabase
    .from("fiscal_invoices")
    .select("numero, chave_acesso, xml_content, xml_url, nuvemfiscal_uuid, payload_json")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .eq("numero", "285")
    .limit(1);
  if (error) throw error;
  const inv = ago?.[0];
  console.log("AGO 285 xml_content FULL:\n", inv?.xml_content);
  console.log("\nAGO 285 payload keys", inv?.payload_json && Object.keys(inv.payload_json));
  console.log("AGO 285 infDPS keys", inv?.payload_json?.infDPS && Object.keys(inv.payload_json.infDPS));
  console.log("AGO 285 uuid", inv?.nuvemfiscal_uuid);

  const { data: jul } = await supabase
    .from("fiscal_invoices")
    .select("numero, chave_acesso, xml_content, xml_url, nuvemfiscal_uuid")
    .eq("organization_id", NHT)
    .eq("tipo_documento", "NFSe")
    .eq("chave_acesso", "7571010726144624040351810692026077397050")
    .limit(1);
  const j = jul?.[0];
  console.log("\nJUL with 40-char chave numero", j?.numero, "chave", j?.chave_acesso);
  console.log("JUL xml_content FULL:\n", j?.xml_content);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
