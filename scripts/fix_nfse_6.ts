import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNFSe6() {
    console.log("Atualizando NFS-e #6 para 'authorized'...");

    // First, find the invoice with numero 6
    const { data: invoices, error: findError } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('numero', '6');

    console.log("Notas encontradas:", invoices);

    if (invoices && invoices.length > 0) {
        const { data, error } = await supabase
            .from('fiscal_invoices')
            .update({
                status: 'authorized',
                numero: '6',
                codigo_verificacao: '7571030226221835580351810692026027396497',
                link_url: 'http://sync.nfs-e.net/datacenter/include/nfw/nfw_imp_notas.php?codauten=7571030226221835580351810692026027396497'
            })
            .eq('id', invoices[0].id)
            .select();

        console.log("Resultado do update:", data, error);
    } else {
        // Try by status processing
        const { data: processing, error: procError } = await supabase
            .from('fiscal_invoices')
            .select('*')
            .eq('status', 'processing')
            .eq('type', 'nfse');

        console.log("Notas em processamento:", processing);

        if (processing && processing.length > 0) {
            const { data, error } = await supabase
                .from('fiscal_invoices')
                .update({
                    status: 'authorized',
                    numero: '6',
                    codigo_verificacao: '7571030226221835580351810692026027396497',
                    link_url: 'http://sync.nfs-e.net/datacenter/include/nfw/nfw_imp_notas.php?codauten=7571030226221835580351810692026027396497'
                })
                .eq('id', processing[0].id)
                .select();

            console.log("Resultado do update:", data, error);
        }
    }
}

fixNFSe6();
