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

export type CobrancaStoreBillingStatus = {
  store?: {
    store_id: string;
    store_name: string;
    monthly_amount: number;
    paid_until: string | null;
    payment_qr_code?: string | null;
    payment_copy_paste?: string | null;
  };
  status: "ativo" | "pendente" | "bloqueado" | "liberado" | "vip";
  reason?: string;
  effectiveAccessUntil?: string | null;
  overdueSince?: string | null;
  blockAfter?: string | null;
  daysPastDue?: number;
  daysUntilDue?: number | null;
  paymentDueSoon?: boolean;
  shouldShowBillingReminder: boolean;
  shouldBlockNewOperations: boolean;
  blockScope: "none" | "new_operations_only";
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

export async function getStoreBillingStatus(storeId: string): Promise<CobrancaStoreBillingStatus> {
  const { baseUrl, clientKey, clientSecret } = getCobrancaGatewayConfig();

  const response = await fetch(`${baseUrl}/api/stores/${encodeURIComponent(storeId)}/status`, {
    method: "GET",
    headers: {
      "x-client-key": clientKey,
      "x-client-secret": clientSecret
    },
    cache: "no-store"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok && data?.reason !== "store_not_registered") {
    const message = data?.error || `Gateway respondeu com status ${response.status}`;
    throw new Error(message);
  }

  return data as CobrancaStoreBillingStatus;
}
