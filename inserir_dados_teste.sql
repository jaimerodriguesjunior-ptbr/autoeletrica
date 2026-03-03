-- ==============================================================================
-- SCRIPT PARA INSERIR DADOS DE EXEMPLO NA NOVA ORGANIZAÇÃO
-- ID da Organização: a60e0d8b-e045-467e-9bcb-9dc463639589
-- ==============================================================================
-- COMO EXECUTAR:
-- 1. Abra o Supabase Studio do seu projeto.
-- 2. Vá para o menu "SQL Editor" na barra lateral esquerda.
-- 3. Clique em "New query".
-- 4. Cole este script inteiro lá e clique em "Run" (ou pressione Ctrl+Enter).
-- ==============================================================================

DO $$
DECLARE
    v_org_id UUID := 'a60e0d8b-e045-467e-9bcb-9dc463639589';
    v_client_id UUID := gen_random_uuid();
    v_vehicle_id UUID := gen_random_uuid();
    v_product_id UUID := gen_random_uuid();
    v_service_id UUID := gen_random_uuid();
    v_work_order_id INTEGER;
BEGIN

    -- 1. Company Settings (Configurações da Empresa)
    IF NOT EXISTS (SELECT 1 FROM company_settings WHERE organization_id = v_org_id) THEN
        INSERT INTO company_settings (
            organization_id, nome_fantasia, razao_social, cnpj, endereco, telefone, email_contato,
            cpf_cnpj, inscricao_estadual, inscricao_municipal, regime_tributario, logradouro, numero, bairro, cidade, uf, cep,
            usa_fiscal, usa_caixa, scheduling_capacity, usa_agendamento
        ) VALUES (
            v_org_id, 'Oficina Teste Auto', 'Oficina Teste Auto Eletrica LTDA', '12.345.678/0001-90', 'Rua das Oficinas, 123', '(11) 99999-9999', 'contato@oficinateste.com.br',
            '12345678000190', 'ISENTO', 'ISENTO', 'Simples Nacional', 'Rua das Oficinas', '123', 'Centro', 'São Paulo', 'SP', '01000-000',
            false, true, 5, true
        );
    END IF;

    -- 2. Client (Cliente Exemplo)
    INSERT INTO clients (
        id, organization_id, nome, cpf_cnpj, whatsapp, email, endereco
    ) VALUES (
        v_client_id, v_org_id, 'Cliente Exemplo Silva', '123.456.789-00', '11988888888', 'cliente@exemplo.com', '{"logradouro": "Av. Paulista", "numero": "1000", "bairro": "Bela Vista", "cidade": "SÃO PAULO", "uf": "SP", "cep": "01310100"}'::jsonb
    );

    -- 3. Vehicle (Veículo do Cliente)
    INSERT INTO vehicles (
        id, organization_id, client_id, placa, modelo, fabricante, ano, cor, obs
    ) VALUES (
        v_vehicle_id, v_org_id, v_client_id, 'ABC1234', 'Gol', 'Volkswagen', 2020, 'Branco', 'Veículo em ótimo estado'
    );

    -- 4. Product (Peça em Estoque)
    INSERT INTO products (
        id, organization_id, nome, marca, codigo_ref, localizacao, estoque_atual, estoque_min, custo_reposicao, custo_contabil, preco_venda, ncm, cfop, unidade
    ) VALUES (
        v_product_id, v_org_id, 'Óleo de Motor 5W30', 'Castrol', 'OLEO-5W30', 'Prateleira A1', 50, 10, 30.00, 30.00, 50.00, '27101932', '5102', 'UN'
    );

    -- 5. Service (Serviço Padrão)
    INSERT INTO services (
        id, organization_id, nome, price, codigo_servico, aliquota_iss
    ) VALUES (
        v_service_id, v_org_id, 'Troca de Óleo e Filtro', 60.00, '14.01', 5.00
    );

    -- 6. Work Order (Ordem de Serviço)
    INSERT INTO work_orders (
        organization_id, client_id, vehicle_id, status, description, total, previsao_entrega, odometro, nivel_combustivel, defeitos_constatados, servicos_executados
    ) VALUES (
        v_org_id, v_client_id, v_vehicle_id, 'em_andamento', 'Revisão periódica', 110.00, CURRENT_DATE + INTERVAL '1 day', '50000', 'Meio Tanque', 'Cliente relatou aviso no painel de óleo', 'Em execução...'
    ) RETURNING id INTO v_work_order_id;

    -- 7. Work Order Items (Item Peça na OS)
    INSERT INTO work_order_items (
        organization_id, work_order_id, product_id, tipo, name, quantity, unit_price, total_price, peca_cliente
    ) VALUES (
        v_org_id, v_work_order_id, v_product_id, 'product', 'Óleo de Motor 5W30', 1, 50.00, 50.00, false
    );

    -- 8. Work Order Items (Item Serviço na OS)
    INSERT INTO work_order_items (
        organization_id, work_order_id, service_id, tipo, name, quantity, unit_price, total_price, peca_cliente
    ) VALUES (
        v_org_id, v_work_order_id, v_service_id, 'service', 'Troca de Óleo e Filtro', 1, 60.00, 60.00, false
    );

    -- 9. Transaction (Lançamento Financeiro)
    INSERT INTO transactions (
        organization_id, work_order_id, description, amount, type, category, status, date
    ) VALUES (
        v_org_id, v_work_order_id, 'Adiantamento - Pagamento OS Revisão', 110.00, 'receita', 'Serviços/Peças', 'pago', CURRENT_DATE
    );

END $$;
