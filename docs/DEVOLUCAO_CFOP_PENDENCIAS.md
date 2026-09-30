# Devolucao de NF-e: CFOP por produto

## Fluxo atual

Na devolucao completa, o aplicativo monta o CFOP por item com base na NF-e de
origem: usa `5411`/`6411` para itens identificados com ICMS-ST e `5202`/`6202`
para os demais, conforme a UF. A Nuvem Local Fiscal continua sendo o ponto
central de resolucao e validacao do payload.

A tela de devolucao completa permite informar CFOP manual por item. Para usar
`5411` manualmente, o payload inclui o opt-in versionado
`metadados.devolucao.manualCfopOverrideV1` e os dados do item. Sem esse
marcador, a Nuvem Local Fiscal segue as regras e o fallback existentes para
clientes atuais.

## Ajustes opcionais da devolucao completa

O caminho completo tambem pode enviar `vOutro`, zerar as bases e valores de
ICMS/ICMS-ST nos grupos correspondentes e incluir informacoes complementares
em `infCpl`. A configuracao e explicita na emissao completa; a devolucao rapida
e os payloads sem esses campos mantem seu comportamento anterior.

No preset solicitado para a NF de origem `519243`, os valores `120,15`,
`14,42`, `172,89` e `19,29` aparecem no texto complementar. O valor `19,29`
tambem e enviado em outras despesas (`vOutro`). Isso reproduz a instrucao
recebida sem recalcular ou trocar os numeros indicados.
