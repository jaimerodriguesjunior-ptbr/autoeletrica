import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        prod_client_id: process.env.NUVEMFISCAL_PROD_CLIENT_ID ? "DEFINIDO" : "AUSENTE",
        prod_client_secret: process.env.NUVEMFISCAL_PROD_CLIENT_SECRET ? "DEFINIDO" : "AUSENTE",
        webhook_secret: process.env.NUVEMFISCAL_WEBHOOK_SECRET ? "DEFINIDO" : "AUSENTE",
        app_url: process.env.NEXT_PUBLIC_APP_URL || "AUSENTE"
    });
}
