import "server-only";

import { getStoreBillingStatus } from "@/src/lib/nuvemLocalCobranca";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { createClient } from "@/src/utils/supabase/server";

export class BillingBlockedError extends Error {
  constructor(message = "Novas operacoes estao bloqueadas para esta loja.") {
    super(message);
    this.name = "BillingBlockedError";
  }
}

type CurrentProfileAccess = {
  userId: string;
  organizationId: string;
  cargo: string | null;
};

async function getProfileAccessByUserId(
  userId: string,
  supabase: ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>
): Promise<CurrentProfileAccess> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, cargo")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.organization_id) {
    throw new Error("Organizacao nao encontrada.");
  }

  return {
    userId,
    organizationId: profile.organization_id,
    cargo: profile.cargo ?? null
  };
}

export async function getCurrentProfileAccess(): Promise<CurrentProfileAccess> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Nao autenticado.");
  }

  return getProfileAccessByUserId(user.id, supabase);
}

export async function getProfileAccessFromBearerToken(token: string): Promise<CurrentProfileAccess> {
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Nao autenticado.");
  }

  return getProfileAccessByUserId(user.id, supabaseAdmin);
}

export async function getRequestProfileAccess(request: Request): Promise<CurrentProfileAccess> {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearerToken ? getProfileAccessFromBearerToken(bearerToken) : getCurrentProfileAccess();
}

export async function assertOrganizationCanCreateNewOperations(organizationId: string) {
  const billingStatus = await getStoreBillingStatus(organizationId);

  const shouldBlockNewOperations =
    billingStatus.status === "bloqueado" ||
    (billingStatus.shouldBlockNewOperations && billingStatus.blockScope === "new_operations_only");

  if (shouldBlockNewOperations) {
    throw new BillingBlockedError(
      "Sua loja esta com novas operacoes bloqueadas por atraso na mensalidade. Consulte o banner de cobranca ou fale com o suporte."
    );
  }

  return billingStatus;
}

export async function assertCurrentUserCanCreateNewOperations() {
  const profile = await getCurrentProfileAccess();
  const billingStatus = await assertOrganizationCanCreateNewOperations(profile.organizationId);

  return {
    profile,
    billingStatus
  };
}

export async function assertRequestCanCreateNewOperations(request: Request) {
  const profile = await getRequestProfileAccess(request);
  const billingStatus = await assertOrganizationCanCreateNewOperations(profile.organizationId);

  return {
    profile,
    billingStatus
  };
}
