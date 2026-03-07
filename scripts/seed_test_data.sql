-- =============================================================
-- SEED: Dados fictícios para tutorial
-- Organization: a60e0d8b-e045-467e-9bcb-9dc463639589
-- =============================================================

-- ===================== 10 CLIENTES =====================
INSERT INTO clients (organization_id, nome, cpf_cnpj, whatsapp, email, endereco, public_token) VALUES
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Carlos Eduardo Silva', '123.456.789-01', '(45) 99901-1001', 'carlos.silva@email.com', '{"cep":"85900-000","rua":"Rua Marechal Deodoro","numero":"450","bairro":"Centro"}', 'tk_carlos_001'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Maria Aparecida Santos', '234.567.890-12', '(45) 99902-2002', 'maria.santos@email.com', '{"cep":"85900-010","rua":"Av. Brasil","numero":"1200","bairro":"Jardim América"}', 'tk_maria_002'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'José Roberto Oliveira', '345.678.901-23', '(45) 99903-3003', 'jose.oliveira@email.com', '{"cep":"85900-020","rua":"Rua Paraná","numero":"88","bairro":"Vila Nova"}', 'tk_jose_003'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Ana Paula Ferreira', '456.789.012-34', '(45) 99904-4004', 'ana.ferreira@email.com', '{"cep":"85900-030","rua":"Rua São Paulo","numero":"320","bairro":"Centro"}', 'tk_ana_004'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Pedro Henrique Costa', '567.890.123-45', '(45) 99905-5005', 'pedro.costa@email.com', '{"cep":"85900-040","rua":"Av. Parigot de Souza","numero":"1550","bairro":"Parque Industrial"}', 'tk_pedro_005'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Fernanda Lima Souza', '678.901.234-56', '(45) 99906-6006', 'fernanda.souza@email.com', '{"cep":"85900-050","rua":"Rua Minas Gerais","numero":"77","bairro":"Jardim Europa"}', 'tk_fernanda_006'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Ricardo Almeida Nunes', '789.012.345-67', '(45) 99907-7007', 'ricardo.nunes@email.com', '{"cep":"85900-060","rua":"Rua Rio Grande do Sul","numero":"210","bairro":"Vila Rica"}', 'tk_ricardo_007'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Transportadora Veloz Ltda', '12.345.678/0001-90', '(45) 99908-8008', 'financeiro@veloz.com.br', '{"cep":"85900-070","rua":"Av. das Indústrias","numero":"3000","bairro":"Distrito Industrial"}', 'tk_veloz_008'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Lucas Gabriel Martins', '890.123.456-78', '(45) 99909-9009', 'lucas.martins@email.com', '{"cep":"85900-080","rua":"Rua Curitiba","numero":"155","bairro":"Centro"}', 'tk_lucas_009'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Juliana Pereira Rocha', '901.234.567-89', '(45) 99910-1010', 'juliana.rocha@email.com', '{"cep":"85900-090","rua":"Rua Bahia","numero":"42","bairro":"Jardim Primavera"}', 'tk_juliana_010');

-- ===================== 10 PEÇAS (PRODUCTS) =====================
INSERT INTO products (organization_id, nome, marca, codigo_ref, estoque_atual, estoque_min, custo_reposicao, custo_contabil, preco_venda, localizacao) VALUES
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Lâmpada H4 60/55W', 'Philips', 'LAMP-H4-001', 25, 5, 18.50, 18.50, 35.00, 'A-01'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Bateria 60Ah', 'Moura', 'BAT-60-002', 8, 3, 320.00, 320.00, 520.00, 'B-01'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Fusível 15A (Kit 10un)', 'Nacional', 'FUS-15-003', 50, 10, 5.00, 5.00, 12.00, 'A-03'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Alternador 90A Gol G5', 'Bosch', 'ALT-90-004', 3, 2, 450.00, 450.00, 750.00, 'C-02'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Motor de Partida Corsa', 'Valeo', 'MDP-COR-005', 4, 2, 380.00, 380.00, 650.00, 'C-03'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Cabo de Vela Palio 1.0', 'NGK', 'CBV-PAL-006', 12, 5, 65.00, 65.00, 120.00, 'A-05'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Relé Auxiliar 12V 40A', 'DNI', 'REL-40-007', 30, 10, 8.00, 8.00, 18.00, 'A-02'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Farol Direito Uno 2010', 'Arteb', 'FAR-UNO-008', 2, 1, 180.00, 180.00, 320.00, 'D-01'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Alarme Automotivo Completo', 'Pósitron', 'ALR-POS-009', 6, 3, 95.00, 95.00, 180.00, 'B-04'),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Central Multimídia 7" Android', 'Pioneer', 'CMM-PIO-010', 3, 1, 650.00, 650.00, 1200.00, 'D-02');

-- ===================== 10 SERVIÇOS =====================
INSERT INTO services (organization_id, nome, price) VALUES
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Revisão Elétrica Completa', 150.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Instalação de Alarme', 120.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Troca de Alternador', 200.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Troca de Motor de Partida', 180.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Instalação de Som Automotivo', 250.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Reparo de Chicote Elétrico', 300.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Instalação de Farol de Milha', 80.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Troca de Bateria', 50.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Diagnóstico por Scanner', 100.00),
('a60e0d8b-e045-467e-9bcb-9dc463639589', 'Instalação de Multimídia', 350.00);
