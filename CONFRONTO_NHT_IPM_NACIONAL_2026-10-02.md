# NHT: confronto IPM e emissão Nacional

Investigação de 02/10/2026, com consultas de leitura aos bancos do aplicativo
e da Nuvem Local Fiscal e download do XML oficial no portal público de Guaíra.
Nenhuma nota foi emitida, alterada ou cancelada nesta investigação.

## Evidências

- Os 32 documentos municipais autorizados em agosto encontrados no provedor
  usaram `guaira-ipm`. Os XMLs de envio tinham alíquota `2,01`, situação
  tributária `0` e ISS retido `0,00`.
- O aplicativo guarda nesses registros o retorno de autorização IPM, não o
  XML municipal completo. A numeração local também difere da oficial.
- Foram baixados diretamente do portal municipal os XMLs completos oficiais:

| Campo | Nota 262, 25/08/2026 | Nota 269, 28/08/2026 |
| --- | --- | --- |
| Valor dos serviços | R$ 320,00 | R$ 350,00 |
| Alíquota municipal | 2,0100% | 2,0100% |
| Situação tributária IPM | 0 | 0 |
| Valor tributável | R$ 320,00 | R$ 350,00 |
| Valor ISSRF | R$ 0,00 | R$ 0,00 |
| Campo separado de valor do ISS próprio | Ausente | Ausente |
| Código explícito de opção/apuração do Simples | Ausente | Ausente |

- Os 10 XMLs nacionais autorizados em setembro encontrados no aplicativo
  têm `opSimpNac=3`, `regApTribSN=1`, `regEspTrib=0`, `tribISSQN=1` e
  `tpRetISSQN=1`: ME/EPP optante, tributos federais e ISS pelo Simples,
  tributável e sem retenção. Não contêm `pAliq`, `pAliqAplic`, `vBC`,
  `vISSQN` ou `vISSRF`.
- O JSON legado do aplicativo contém `pAliq=2.01` e `vISSQN=0`, mas o
  adaptador Nacional não transmite esse `vISSQN` na DPS e omite a alíquota
  para o enquadramento acima. O IPM recebia a alíquota municipal.

## Interpretação e limites

O histórico confirma ausência de ISS retido e ausência de um campo separado
de ISS próprio nos dois XMLs municipais completos examinados. Os formatos,
porém, não são idênticos: o municipal apresenta valor tributável e alíquota;
o nacional examinado não apresenta base nem alíquota aplicada.

As regras nacionais E0625/E0631 proíbem informar alíquota para ME/EPP com
ISS pelo Simples, sem retenção, nas condições previstas nessas regras.
Ausência de destaque de ISS, isoladamente, não prova defeito de emissão.
Referência: [Anexo I de produção](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_i-sefin_adn-dps_nfse-snnfse-v1-01-20260209.xlsx).

O XML municipal examinado não explicita o regime de apuração do Simples.
Portanto, não é possível provar apenas com ele que o enquadramento fiscal
da empresa era exatamente o mesmo em agosto. A configuração atual e o
cadastro do aplicativo também não substituem a confirmação contábil por
competência, inclusive eventual impedimento ou sublimite.

É plausível haver diferença no tratamento/importação municipal das notas
do ADN. Não há evidência suficiente para atribuir definitivamente o bloqueio
ao IPM, à prefeitura ou à emissão Nacional.

## Verificação a pedir ao contador

Confirmar se o ISS da NHT permanece dentro do Simples, sem retenção, nas
competências examinadas. Confirmado isso, pedir ao suporte de Guaíra/IPM
que confronte o tratamento das notas municipais 262 e 269 com as nacionais
1, 2 e 4 a 11 e explique como protocolar documentos do ADN sem destaque
de ISS nesse enquadramento. Não alterar regime ou retenção somente para
contornar a validação municipal.
