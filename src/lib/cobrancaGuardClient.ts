import { createClient } from "@/src/lib/supabase";

export async function getBillingAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`
  };
}

export async function ensureBillingAllowsNewOperations() {
  const authHeaders = await getBillingAuthHeaders();

  const response = await fetch("/api/cobranca/guard", {
    method: "GET",
    cache: "no-store",
    headers: authHeaders
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.blocked) {
    throw new Error(
      data?.error ||
        data?.message ||
        "Novas operacoes estao temporariamente bloqueadas para esta loja."
    );
  }

  return data;
}
