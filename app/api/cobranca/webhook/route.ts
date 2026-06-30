import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function readWebhookSecret(request: NextRequest) {
  return (
    request.headers.get("authorization") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-nuvem-local-secret")
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/cobranca/webhook",
    method: "POST"
  });
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.NUVEM_LOCAL_COBRANCA_WEBHOOK_SECRET;
    const providedSecret = readWebhookSecret(request);

    if (expectedSecret && providedSecret !== `Bearer ${expectedSecret}` && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    console.log("[Webhook Cobranca] Recebido:", JSON.stringify(body, null, 2));

    return NextResponse.json({
      ok: true,
      receivedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Webhook Cobranca] Erro interno:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
