import type { Metadata } from "next";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { PUBLIC_APP_ORIGIN } from "@/src/lib/publicAppUrl";
import PortalClient from "./PortalClient";

type PageProps = {
  searchParams?: {
    token?: string | string[];
  };
};

async function getWorkshopPreview(token: string) {
  const supabase = createAdminClient();

  const { data: workOrder } = await supabase
    .from("work_orders")
    .select("organization_id")
    .eq("public_token", token)
    .maybeSingle();

  let organizationId = workOrder?.organization_id;

  if (!organizationId) {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("organization_id")
      .eq("token", token)
      .maybeSingle();

    organizationId = appointment?.organization_id;
  }

  if (!organizationId) return null;

  const { data: company } = await supabase
    .from("company_settings")
    .select("nome_fantasia, logo_impressos_url, logo_url")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (!company) return null;

  return {
    name: company.nome_fantasia?.trim() || "Oficina",
    logoUrl: company.logo_impressos_url || company.logo_url || null,
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const rawToken = searchParams?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const portalUrl = token
    ? `${PUBLIC_APP_ORIGIN}/acompanhar?token=${encodeURIComponent(token)}`
    : `${PUBLIC_APP_ORIGIN}/acompanhar`;

  let workshopName = "Portal da Oficina";
  let logoUrl: string | null = null;

  if (token) {
    try {
      const preview = await getWorkshopPreview(token);
      if (preview) {
        workshopName = preview.name;
        logoUrl = preview.logoUrl;
      }
    } catch (error) {
      console.error("[Portal Metadata] Erro ao carregar oficina:", error);
    }
  }

  const imageUrl = logoUrl || `${PUBLIC_APP_ORIGIN}/web-app-manifest-512x512.png`;

  return {
    metadataBase: new URL(PUBLIC_APP_ORIGIN),
    title: workshopName,
    description: "Acompanhe o serviço e consulte seu orçamento.",
    alternates: {
      canonical: portalUrl,
    },
    openGraph: {
      title: workshopName,
      description: "Acompanhe o serviço e consulte seu orçamento.",
      url: portalUrl,
      siteName: workshopName,
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
          alt: `Logo ${workshopName}`,
        },
      ],
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: workshopName,
      description: "Acompanhe o serviço e consulte seu orçamento.",
      images: [imageUrl],
    },
  };
}

export default function AcompanharPage() {
  return <PortalClient />;
}
