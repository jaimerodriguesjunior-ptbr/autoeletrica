import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/src/utils/supabase/admin'

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Token não informado.' }, { status: 400 })
    }

    try {
        const supabase = createAdminClient()

        // Buscar OS pelo public_token
        const { data: os, error } = await supabase
            .from('work_orders')
            .select(`
        *,
        vehicles ( modelo, placa, cor, fabricante ),
        clients ( nome, whatsapp ),
        work_order_items ( name, total_price, peca_cliente )
      `)
            .eq('public_token', token)
            .single()

        if (error || !os) {
            return NextResponse.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
        }

        // Buscar logo e telefone da empresa
        let logoUrl: string | null = null
        let telefone: string | null = null

        if (os.organization_id) {
            const { data: companyData } = await supabase
                .from('company_settings')
                .select('logo_url, telefone')
                .eq('organization_id', os.organization_id)
                .limit(1)
                .single()

            if (companyData) {
                logoUrl = companyData.logo_url || null
                telefone = companyData.telefone || null
            }
        }

        return NextResponse.json({ os, logoUrl, telefone })
    } catch (err: any) {
        console.error('[Portal OS] Erro:', err.message)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
