type CreateBillingInput = {
  store: {
    id: string;
    name: string;
    document?: string;
  };
  customerId?: string;
  customer?: {
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    externalReference?: string;
    notificationDisabled?: boolean;
  };
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
  amount: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
}

export function getCobrancaGatewayConfig() {
  return {
    baseUrl: getRequiredEnv("NUVEM_LOCAL_COBRANCA_API_URL").replace(/\/$/, ""),
    clientKey: getRequiredEnv("NUVEM_LOCAL_COBRANCA_CLIENT_KEY"),
    clientSecret: getRequiredEnv("NUVEM_LOCAL_COBRANCA_CLIENT_SECRET")
  };
}

export async function createGatewayBilling(input: CreateBillingInput) {
  const { baseUrl, clientKey, clientSecret } = getCobrancaGatewayConfig();

  const response = await fetch(`${baseUrl}/api/billings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-key": clientKey,
      "x-client-secret": clientSecret
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error || `Gateway respondeu com status ${response.status}`;
    throw new Error(message);
  }

  return data;
}
