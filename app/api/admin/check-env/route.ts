export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        hom_client_id: process.env.NUVEMFISCAL_HOM_CLIENT_ID ? "DEFINIDO" : "AUSENTE",
        hom_client_secret: process.env.NUVEMFISCAL_HOM_CLIENT_SECRET ? "DEFINIDO" : "AUSENTE",
        hom_url: process.env.NUVEMFISCAL_HOM_URL || "AUSENTE",
        hom_auth_url: process.env.NUVEMFISCAL_HOM_AUTH_URL || "AUSENTE",
        prod_client_id: process.env.NUVEMFISCAL_PROD_CLIENT_ID ? "DEFINIDO" : "AUSENTE",
        prod_client_secret: process.env.NUVEMFISCAL_PROD_CLIENT_SECRET ? "DEFINIDO" : "AUSENTE",
        prod_url: process.env.NUVEMFISCAL_PROD_URL || "AUSENTE",
        prod_auth_url: process.env.NUVEMFISCAL_PROD_AUTH_URL || "AUSENTE",
        legacy_url: process.env.NUVEMFISCAL_URL || "AUSENTE",
        webhook_secret: process.env.NUVEMFISCAL_WEBHOOK_SECRET ? "DEFINIDO" : "AUSENTE",
        app_url: process.env.NEXT_PUBLIC_APP_URL || "AUSENTE"
    });
}
