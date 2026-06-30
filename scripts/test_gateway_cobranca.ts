import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createGatewayBilling, getCobrancaGatewayConfig } from "../src/lib/nuvemLocalCobranca";

async function main() {
  const config = getCobrancaGatewayConfig();
  console.log("[Gateway] URL:", config.baseUrl);

  const payload = {
    customer: {
      name: "Cliente Teste",
      cpfCnpj: "58212043134",
      email: "teste@autoeletrica.vercel.app",
      mobilePhone: "44999261487",
      externalReference: "autoeletrica-test"
    },
    billingType: "PIX" as const,
    amount: 10,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: "Teste inicial do gateway de cobranca",
    externalReference: `test-${Date.now()}`
  };

  const result = await createGatewayBilling(payload);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[Gateway] Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
