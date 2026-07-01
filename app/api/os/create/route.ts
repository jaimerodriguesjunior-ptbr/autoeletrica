import { NextResponse } from "next/server";

import {
  BillingBlockedError,
  assertRequestCanCreateNewOperations
} from "@/src/lib/billing-guard";
import { createAdminClient } from "@/src/utils/supabase/admin";

export const dynamic = "force-dynamic";

type CreateOsBody = {
  clientId?: string | null;
  vehicleId?: string | null;
  description?: string | null;
  odometro?: string | null;
  nivelCombustivel?: string | null;
  temperaturaMotor?: string | null;
  painelObs?: string | null;
};

export async function POST(request: Request) {
  try {
    const { profile } = await assertRequestCanCreateNewOperations(request);
    const body = (await request.json()) as CreateOsBody;

    if (!body?.clientId) {
      return NextResponse.json({ error: "Cliente obrigatorio." }, { status: 400 });
    }

    if (!body?.vehicleId) {
      return NextResponse.json({ error: "Veiculo obrigatorio." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        organization_id: profile.organizationId,
        client_id: body.clientId,
        vehicle_id: body.vehicleId,
        status: "orcamento",
        tipo: "os",
        description: body.description ?? "",
        odometro: body.odometro || null,
        nivel_combustivel: body.nivelCombustivel || null,
        temperatura_motor: body.temperaturaMotor || null,
        painel_obs: body.painelObs || null,
        employee_id: profile.userId
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ workOrder: data });
  } catch (error) {
    if (error instanceof BillingBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Erro ao criar OS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
