import { NextResponse } from "next/server";

import {
  BillingBlockedError,
  assertRequestCanCreateNewOperations
} from "@/src/lib/billing-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertRequestCanCreateNewOperations(request);
    return NextResponse.json({ blocked: false });
  } catch (error) {
    if (error instanceof BillingBlockedError) {
      return NextResponse.json(
        {
          blocked: true,
          message: error.message
        },
        { status: 403 }
      );
    }

    const message = error instanceof Error ? error.message : "Erro ao validar cobranca.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
