import { NextResponse } from "next/server";

import {
  BillingAuthenticationError,
  BillingBlockedError,
  BillingProfileError,
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
          reason: "billing_blocked",
          message: error.message
        },
        { status: 403 }
      );
    }

    if (error instanceof BillingAuthenticationError) {
      return NextResponse.json(
        {
          blocked: true,
          reason: "unauthenticated",
          error: error.message
        },
        { status: 401 }
      );
    }

    if (error instanceof BillingProfileError) {
      return NextResponse.json(
        {
          blocked: true,
          reason: "profile_not_found",
          error: error.message
        },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : "Erro ao validar cobranca.";
    return NextResponse.json(
      {
        blocked: true,
        reason: "billing_guard_unavailable",
        error: message
      },
      { status: 503 }
    );
  }
}
