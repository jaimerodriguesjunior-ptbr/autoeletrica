-- Função para consolidar dados de fechamento mensal para o contador
CREATE OR REPLACE FUNCTION get_monthly_closing_data(
    p_organization_id UUID,
    p_month INT,
    p_year INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_result JSONB;
BEGIN
    -- Define o intervalo do mês
    v_start_date := (p_year || '-' || p_month || '-01')::DATE;
    v_end_date := (v_start_date + interval '1 month')::DATE;

    WITH 
    pecas_servicos AS (
        -- Soma Peças e Serviços de OS finalizadas que tiveram movimentação financeira no mês
        SELECT 
            COALESCE(SUM(CASE WHEN i.tipo = 'peca' AND NOT COALESCE(i.peca_cliente, false) THEN i.total_price ELSE 0 END), 0) as total_pecas,
            COALESCE(SUM(CASE WHEN i.tipo = 'servico' THEN i.total_price ELSE 0 END), 0) as total_servicos
        FROM work_orders o
        JOIN work_order_items i ON i.work_order_id = o.id
        WHERE o.organization_id = p_organization_id
        AND o.status IN ('entregue', 'finalizado')
        AND EXISTS (
            SELECT 1 FROM transactions t 
            WHERE t.work_order_id = o.id 
            AND t.date >= v_start_date 
            AND t.date < v_end_date
            AND t.type = 'income'
        )
    ),
    meios_pagamento AS (
        -- Agrupa recebimentos (entradas) por forma de pagamento
        SELECT 
            COALESCE(payment_method, 
                CASE 
                    WHEN description ILIKE '%(pix)%' OR description ILIKE '% pix %' THEN 'pix'
                    WHEN description ILIKE '%(cartao_credito)%' OR description ILIKE '%credito%' THEN 'cartao_credito'
                    WHEN description ILIKE '%(cartao_debito)%' OR description ILIKE '%debito%' THEN 'cartao_debito'
                    WHEN description ILIKE '%(dinheiro)%' THEN 'dinheiro'
                    WHEN description ILIKE '%(boleto)%' THEN 'boleto'
                    WHEN description ILIKE '%(cheque)%' THEN 'cheque_pre'
                    ELSE 'outros'
                END
            ) as metodo,
            SUM(amount) as total
        FROM transactions
        WHERE organization_id = p_organization_id
        AND type = 'income'
        AND date >= v_start_date
        AND date < v_end_date
        GROUP BY 1
    ),
    fiscal_resumo AS (
        -- Resumo de documentos fiscais (NFC-e, NFS-e e NFe de entrada)
        SELECT 
            COUNT(*) FILTER (WHERE direction = 'output' AND tipo_documento = 'NFSe' AND status = 'authorized') as autorizadas_nfse,
            COUNT(*) FILTER (WHERE direction = 'output' AND tipo_documento = 'NFSe' AND status = 'cancelled') as canceladas_nfse,
            COUNT(*) FILTER (WHERE direction = 'output' AND tipo_documento = 'NFCe' AND status = 'authorized') as autorizadas_nfce,
            COUNT(*) FILTER (WHERE direction = 'output' AND tipo_documento = 'NFCe' AND status = 'cancelled') as canceladas_nfce,
            COUNT(*) FILTER (WHERE direction = 'entry') as entradas_qtd,
            COALESCE(SUM(valor_total) FILTER (WHERE direction = 'entry'), 0) as entradas_valor
        FROM fiscal_invoices
        WHERE organization_id = p_organization_id
        AND COALESCE(environment, 'production') != 'homologation'
        AND (
            (data_emissao >= v_start_date AND data_emissao < v_end_date)
            OR 
            (created_at >= v_start_date AND created_at < v_end_date)
        )
    )
    SELECT jsonb_build_object(
        'faturamento', (SELECT jsonb_build_object('total_pecas', total_pecas, 'total_servicos', total_servicos) FROM pecas_servicos),
        'pagamentos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('metodo', metodo, 'total', total)), '[]'::jsonb) FROM meios_pagamento),
        'fiscal', (SELECT jsonb_build_object(
            'autorizadas_nfse', autorizadas_nfse,
            'canceladas_nfse', canceladas_nfse,
            'autorizadas_nfce', autorizadas_nfce,
            'canceladas_nfce', canceladas_nfce,
            'entradas_qtd', entradas_qtd,
            'entradas_valor', entradas_valor
        ) FROM fiscal_resumo)
    ) INTO v_result;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
