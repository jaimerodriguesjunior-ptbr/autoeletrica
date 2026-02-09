Resumo técnico — Falha NFS-e Guaíra/PR (IPM via Nuvem Fiscal)

Hipóteses descartadas (até aqui)

Credenciais ausentes: o fluxo já exige nfse_login no company_settings e usa token válido via getNuvemFiscalToken.
Endpoint errado: emissão está indo para POST /nfse/dps com token bearer (caminho correto na Nuvem Fiscal).
Payload “vazio”: o DPS contém prestador, tomador, serviço e valores mínimos.
Inconsistências encontradas no código

Código de serviço x CNAE invertidos
Em fiscal_emission.ts, o DPS fixa:

cTribNac = "140102"
cTribMun = "4520007"
CNAE = "4520007"
O script IPM (test_direct_ipm.ts) deixa claro que 140102 é o código da lista LC 116 e 4520007 é CNAE.
Hoje, o código municipal (serviço) está recebendo CNAE — isso costuma rejeitar em IPM.
codigo_servico do cadastro não é usado
O payload de serviços montado em page.tsx não inclui codigo_servico nem aliquota_iss.
No emitirNFSe, o DPS também ignora codigo_servico do item.

Local de prestação/incidência ausente
O XML IPM usa codigo_local_prestacao_servico (4108809).
O DPS atual não manda locPrest nem cLocIncid (exigência comum em IPM).

Provável causa raiz
A emissão falha porque o DPS leva CNAE no lugar do código de serviço municipal e não informa local de prestação/incidência; além disso, o codigo_servico configurado nunca chega ao payload.
Isso produz rejeição municipal típica do provedor IPM (erro de item de serviço inexistente/incompatível), possivelmente só visível na consulta do status da NFS-e.

Checklist de correções (sem aplicar mudanças)

Em page.tsx, incluir codigo_servico e aliquota_iss no servicosPayload.
Em fiscal_emission.ts:
Usar servicoPrincipal.codigo_servico em cTribNac (ou equivalente exigido pelo schema).
Não usar CNAE como cTribMun.
Manter CNAE separado como CNAE real.
Adicionar local de prestação/incidência:
serv.locPrest.cLocPrestacao (IBGE 4108809).
valores.trib.tribMun.cLocIncid (mesmo IBGE).
Validar se IPM exige base de cálculo/ISS informados mesmo quando pAliq > 0, e garantir coerência (vISSQN calculado).