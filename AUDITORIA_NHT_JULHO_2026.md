# Auditoria fiscal — NHT / Norberto — julho de 2026

## Resultado final do cruzamento

Os arquivos enviados pelo contador permitem fechar as duas diferenças de valor.

| Documento | Fonte oficial | Sistema | Resultado |
|---|---:|---:|---|
| NFC-e | R$ 7.005,00 | R$ 6.995,00 | A diferença de R$ 10,00 é uma NF-e, não uma NFC-e. |
| NFS-e | R$ 15.300,00 | R$ 15.370,00 | O sistema ainda contabiliza uma NFS-e cancelada de R$ 70,00. |

## NFC-e: não há diferença entre as NFC-e

O PDF `NOTAS SAIDAS 07-2026- NORBERTO.pdf` lista:

- NFC-e série 2, números 75 a 127 (com as lacunas de tentativas não autorizadas): total de **R$ 6.995,00**.
- NF-e série 1, número 11, emitida em 03/07: **R$ 10,00**.

O rodapé do PDF totaliza os dois documentos e chega a R$ 7.005,00. Portanto:

```
R$ 6.995,00  NFC-e em produção no sistema
R$    10,00  NF-e nº 11 no PDF da SEFAZ
-------------
R$ 7.005,00  total do PDF
```

A emissão em homologação realmente ocorreu no Norberto: há quatro NFC-e "autorizadas" com XML `tpAmb = 2` (números internos 4, 5, 6 e 12, de 02/07). Elas não são válidas em produção e não entram no total de R$ 6.995,00. Não são a origem da diferença de R$ 10,00.

## NFS-e: diferença identificada

O arquivo da Prefeitura contém 49 NFS-e no mês:

- 47 emitidas, totalizando **R$ 15.300,00**;
- 2 canceladas: municipais 227 e 234, ambas de R$ 70,00.

As 48 NFS-e que o sistema mantém como autorizadas em produção somam R$ 15.370,00. O cruzamento por número municipal mostra que todas existem no arquivo da Prefeitura, mas uma está com situação diferente:

| Campo | Informação |
|---|---|
| NFS-e municipal | 227 |
| Valor | R$ 70,00 |
| Emissão | 20/07/2026 |
| Situação na Prefeitura | Cancelada em 29/07/2026 |
| Motivo na Prefeitura | Dados cadastrais errado |
| Número interno no sistema | 225 |
| UUID interno | `doc_bb49947f` |
| Situação no sistema | `authorized` |

Essa única nota explica a diferença:

```
R$ 15.370,00  sistema, incluindo a NFS-e municipal 227
- R$    70,00  NFS-e 227 cancelada na Prefeitura
--------------
R$ 15.300,00  Prefeitura
```

## Ação recomendada

Atualizar a NFS-e interna 225 (`doc_bb49947f`) para `cancelled`, preservando o histórico e o motivo do cancelamento. Não deve ser apagada. Depois disso, o valor de NFS-e autorizadas em julho no sistema ficará em R$ 15.300,00 e coincidirá com a Prefeitura.

## Observação técnica

Há duas linhas de controle de sequência para NFC-e série 2 na organização NHT. Isso não causou a divergência financeira de julho, mas deve ser corrigido separadamente para não gerar problemas futuros de numeração.
