import { NextResponse } from "next/server";

import { getStoreBillingStatus } from "@/src/lib/nuvemLocalCobranca";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { createClient } from "@/src/utils/supabase/server";

export const dynamic = "force-dynamic";

type BillingProfileAccess = {
  organizationId: string;
  cargo: string | null;
};

async function getProfileAccessFromBearerToken(token: string): Promise<BillingProfileAccess | null> {
  const supabaseAdmin = createAdminClient();
  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id, cargo")
    .eq("id", user.id)
    .single();

  return profile?.organization_id
    ? {
        organizationId: profile.organization_id,
        cargo: profile.cargo ?? null
      }
    : null;
}

async function getProfileAccessFromSession(): Promise<BillingProfileAccess | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, cargo")
    .eq("id", user.id)
    .single();

  return profile?.organization_id
    ? {
        organizationId: profile.organization_id,
        cargo: profile.cargo ?? null
      }
    : null;
}

export async function GET(request: Request) {
  try {
    const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const profileAccess = bearerToken
      ? await getProfileAccessFromBearerToken(bearerToken)
      : await getProfileAccessFromSession();

    if (!profileAccess?.organizationId) {
      return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 404 });
    }

    if (profileAccess.cargo !== "owner") {
      return NextResponse.json({ error: "Acesso restrito ao gerente." }, { status: 403 });
    }

    const billingStatus = await getStoreBillingStatus(profileAccess.organizationId);
    return NextResponse.json(billingStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar cobranca.";

    return NextResponse.json(
      {
        error: message
      },
      { status: 502 }
    );
  }
}
