import type { Metadata } from "next";
import { PUBLIC_APP_ORIGIN } from "@/src/lib/publicAppUrl";
import { createAdminClient } from "@/src/utils/supabase/admin";
import ExtratoClient from "./ExtratoClient";

type PageProps = {
  searchParams?: { token?: string | string[] };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const rawToken = searchParams?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  let companyName = "Oficina";
  let logoUrl: string | null = null;

  if (token) {
    try {
      const supabase = createAdminClient();
      const { data: client } = await supabase.from("clients")
        .select("organization_id").eq("public_token", token).maybeSingle();
      if (client?.organization_id) {
        const { data: company } = await supabase.from("company_settings")
          .select("nome_fantasia, razao_social, logo_impressos_url, logo_url")
          .eq("organization_id", client.organization_id).limit(1).maybeSingle();
        companyName = company?.nome_fantasia?.trim() || company?.razao_social?.trim() || companyName;
        logoUrl = company?.logo_impressos_url || company?.logo_url || null;
      }
    } catch (error) {
      console.error("[Extrato Metadata] Erro ao carregar oficina:", error);
    }
  }

  const url = token
    ? `${PUBLIC_APP_ORIGIN}/extrato?token=${encodeURIComponent(token)}`
    : `${PUBLIC_APP_ORIGIN}/extrato`;
  const description = "Consulte seu extrato financeiro com a oficina.";
  const images = logoUrl ? [{ url: logoUrl, alt: `Logo ${companyName}` }] : [];

  return {
    metadataBase: new URL(PUBLIC_APP_ORIGIN),
    title: companyName,
    description,
    manifest: null,
    icons: { icon: logoUrl ? [{ url: logoUrl }] : [], shortcut: [], apple: [] },
    alternates: { canonical: url },
    openGraph: { title: companyName, siteName: companyName, description, url, images, locale: "pt_BR", type: "website" },
    twitter: { card: "summary", title: companyName, description, images: logoUrl ? [logoUrl] : [] },
  };
}

export default function ExtratoPage() {
  return <ExtratoClient />;
}
