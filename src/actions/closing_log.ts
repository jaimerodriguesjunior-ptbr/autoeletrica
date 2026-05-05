"use server";

import { createClient } from "@/src/utils/supabase/server";

export async function getClosingLog(year: number, month: number) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (!profile?.organization_id) return null;

        const { data } = await supabase
            .from("monthly_closing_log")
            .select("*")
            .eq("organization_id", profile.organization_id)
            .eq("year", year)
            .eq("month", month)
            .maybeSingle();

        return data as { id: string; year: number; month: number; sent_at: string; status: string; error_message: string | null } | null;
    } catch {
        return null;
    }
}

export async function getCompanyFiscalStatus() {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (!profile?.organization_id) return null;

        const { data } = await supabase
            .from("company_settings")
            .select("usa_fiscal, email_contador")
            .eq("organization_id", profile.organization_id)
            .single();

        return data as { usa_fiscal: boolean; email_contador: string | null } | null;
    } catch {
        return null;
    }
}
