-- Atualização de NCMs inferidos por IA

-- Lâmpadas Halógenas (H1, H3, H4, H7, etc) -> 8539.21.10
UPDATE products SET ncm = '85392110', cfop = '5102' WHERE nome ILIKE '%H1%' OR nome ILIKE '%H3%' OR nome ILIKE '%H4%' OR nome ILIKE '%H7%' OR nome ILIKE '%HB3%' OR nome ILIKE '%HB4%' OR nome ILIKE '%H11%' OR nome ILIKE '%H16%' OR nome ILIKE '%H27%' OR nome ILIKE '%HIR2%';

-- Lâmpadas LED -> 85395200
UPDATE products SET ncm = '85395200', cfop = '5102' WHERE nome ILIKE '%LED%';

-- Lâmpadas Incandescentes (Pingo, Polo, Painel, Torpedo) -> 85392910
UPDATE products SET ncm = '85392910', cfop = '5102' WHERE (nome ILIKE '%PINGO%' OR nome ILIKE '%PINGAO%' OR nome ILIKE '%POLO%' OR nome ILIKE '%PAINEL%' OR nome ILIKE '%TORPEDO%' OR nome ILIKE '%67%' OR nome ILIKE '%10W%' OR nome ILIKE '%5W%' OR nome ILIKE '%1.2W%' OR nome ILIKE '%1.5W%' OR nome ILIKE '%2W%') AND ncm IS NULL;

-- Rolamentos -> 84821010
UPDATE products SET ncm = '84821010', cfop = '5102' WHERE nome ILIKE '%ROLAMENTO%';

-- Porta Escovas, Escovas, Planetárias, Buchas (Peças de Partida/Alternador) -> 85119000
UPDATE products SET ncm = '85119000', cfop = '5102' WHERE nome ILIKE '%PORTA ESCOVA%' OR nome ILIKE '%ESCOVA%' OR nome ILIKE '%PLANETARIA%' OR nome ILIKE '%BUCHA PARTIDA%' OR nome ILIKE '%INDUZIDO%';

-- Relés -> 85364100
UPDATE products SET ncm = '85364100', cfop = '5102' WHERE nome ILIKE '%RELE%';

-- Interruptores, Botões, Comutadores -> 85365090
UPDATE products SET ncm = '85365090', cfop = '5102' WHERE nome ILIKE '%INTERRUPTOR%' OR nome ILIKE '%BOTAO%' OR nome ILIKE '%COMUTADOR%';

-- Reguladores de Voltagem -> 85118020
UPDATE products SET ncm = '85118020', cfop = '5102' WHERE nome ILIKE '%REGULADOR%';

-- Auto Falantes -> 85182100
UPDATE products SET ncm = '85182100', cfop = '5102' WHERE nome ILIKE '%AUTO FALANTE%' OR nome ILIKE '%ALTO FALANTE%';

-- Centrais / Módulos -> 85371090
UPDATE products SET ncm = '85371090', cfop = '5102' WHERE nome ILIKE '%CENTRAL%' OR nome ILIKE '%MODULO%';

-- Chicotes -> 85443000
UPDATE products SET ncm = '85443000', cfop = '5102' WHERE nome ILIKE '%CHICOTE%';

-- Molduras (Plástico) -> 39269090
UPDATE products SET ncm = '39269090', cfop = '5102' WHERE nome ILIKE '%MOLDURA%';

-- Câmeras -> 85258913
UPDATE products SET ncm = '85258913', cfop = '5102' WHERE nome ILIKE '%CAMERA%';

-- Velas -> 85111000
UPDATE products SET ncm = '85111000', cfop = '5102' WHERE nome ILIKE '%VELA%';

-- Eletroventiladores -> 84145990
UPDATE products SET ncm = '84145990', cfop = '5102' WHERE nome ILIKE '%ELETROVENTILADOR%' OR nome ILIKE '%VENTOINHA%';

-- Motores Elétricos (Trava, Vidro) -> 85011019
UPDATE products SET ncm = '85011019', cfop = '5102' WHERE nome ILIKE '%MOTOR%';

-- Cebolinha (Sensor de Temperatura/Óleo) -> 90262010
UPDATE products SET ncm = '90262010', cfop = '5102' WHERE nome ILIKE '%CEBOLINHA%';

-- Motobomba (Lavador) -> 84133090
UPDATE products SET ncm = '84133090', cfop = '5102' WHERE nome ILIKE '%MOTOBOMBA%';

-- MTE (Sensores diversos) -> 90262010 (Assume sensores de temperatura)
UPDATE products SET ncm = '90262010', cfop = '5102' WHERE nome ILIKE '%MTE%';

-- Default para o restante (Outras peças de veículos) -> 87089990
UPDATE products SET ncm = '87089990', cfop = '5102' WHERE ncm IS NULL;
