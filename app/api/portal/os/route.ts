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
            // Se não achou OS, tenta achar na tabela appointments
            const { data: apt, error: aptError } = await supabase
                .from('appointments')
                .select(`
                  *,
                  vehicles ( modelo, placa, cor, fabricante ),
                  clients ( nome, whatsapp )
                `)
                .eq('token', token)
                .single()

            if (aptError || !apt) {
                return NextResponse.json({ error: 'Ordem de Serviço ou Agendamento não encontrado.' }, { status: 404 })
            }

            // Achou agendamento! Processa a logo/telefone da empresa baseada no apt
            let logoUrl: string | null = null
            let telefone: string | null = null
            let companySettingsApt: any = null

            if (apt.organization_id) {
                const { data: companyData } = await supabase
                    .from('company_settings')
                    .select('logo_url, telefone, fin_mostrar_portal, fin_cartao_com_juros, fin_taxa_juros_mes, fin_chave_pix, fin_cidade_pix, nome_fantasia')
                    .eq('organization_id', apt.organization_id)
                    .limit(1)
                    .single()

                if (companyData) {
                    logoUrl = companyData.logo_url || null
                    telefone = companyData.telefone || null
                    companySettingsApt = companyData
                }
            }

            return NextResponse.json({ os: apt, logoUrl, telefone, isAppointment: true, companySettings: companySettingsApt })
        }

        // Buscar logo e telefone da empresa
        let logoUrl: string | null = null
        let telefone: string | null = null
        let companySettingsData: any = null

        if (os.organization_id) {
            const { data: companyData } = await supabase
                .from('company_settings')
                .select('logo_url, telefone, fin_mostrar_portal, fin_cartao_com_juros, fin_taxa_juros_mes, fin_chave_pix, fin_cidade_pix, nome_fantasia')
                .eq('organization_id', os.organization_id)
                .limit(1)
                .single()

            if (companyData) {
                logoUrl = companyData.logo_url || null
                telefone = companyData.telefone || null
                companySettingsData = companyData
            }
        }

        // Buscar agendamentos futuros vinculados a esta OS
        const { data: futureAppointments } = await supabase
            .from('appointments')
            .select('id, start_time, duration_minutes, type, status, description, token')
            .eq('work_order_id', os.id)
            .neq('status', 'cancelado')
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true })

        // Buscar notas fiscais autorizadas vinculadas a esta OS
        const { data: invoices } = await supabase
            .from('fiscal_invoices')
            .select('id, tipo_documento, numero, serie, pdf_url, chave_acesso')
            .eq('work_order_id', os.id)
            .eq('status', 'authorized')
            .eq('direction', 'output')

        return NextResponse.json({ 
            os, 
            logoUrl, 
            telefone, 
            isAppointment: false, 
            appointments: futureAppointments || [],
            invoices: invoices || [],
            companySettings: companySettingsData
        })
    } catch (err: any) {
        console.error('[Portal OS] Erro:', err.message)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
