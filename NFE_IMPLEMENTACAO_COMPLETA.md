# Plano Completo de Implementacao - NF-e (Modelo 55)

## Objetivo
Criar uma pagina completa de emissao de NF-e (modelo 55), separada dos fluxos rapidos ja existentes, capaz de conduzir o usuario pelas operacoes fiscais mais comuns com seguranca, validacao e revisao antes da transmissao.

Este documento define a arquitetura de produto, UI, regras, dados e fases para retomar a implementacao em qualquer contexto.

## Estado Atual
- Ja existe emissao de NFC-e e NFS-e no fluxo fiscal atual.
- Ja existe NF-e rapida de venda no fluxo atual de emissao avulsa/baseada em OS.
- Ja existe NF-e de devolucao a partir de NF-e importada.
- Ja existe integracao com Nuvem Fiscal, webhook, armazenamento de XML/PDF e proxy de impressao.
- NF-e rapida de venda foi validada em homologacao no MVP fiscal simplificado.

## Validacao em Homologacao (MVP Atual)
- NFS-e somente servico: validada em homologacao.
- NFC-e de produto: validada em homologacao.
- NF-e rapida PR -> PR: validada em homologacao com CFOP 5102.
- NF-e rapida PR -> outro estado: validada em homologacao com CFOP 6102.
- NF-e completa `/fiscal/nfe` para Venda comum: validada em homologacao reaproveitando o backend da NF-e rapida.
- Remessa para conserto na pagina completa: implementada para emissao real, com CFOP 5915/6915 conforme UF do participante, CSOSN 400, sem cobranca/pagamento (`tPag 90`) e observacao fiscal propria.
- Remessa em garantia na pagina completa: implementada para emissao real reaproveitando a base de remessa sem cobranca, com CFOP 5915/6915 conforme UF do participante, CSOSN 400 e observacao fiscal propria de garantia.
- Retorno de conserto na pagina completa: implementado para emissao real, com selecao de uma NF-e de remessa para conserto autorizada, referencia da chave original, itens carregados do XML, CFOP 5916/6916, CSOSN 400 e sem cobranca/pagamento (`tPag 90`).
- Retorno de garantia na pagina completa: implementado para emissao real, com selecao de uma NF-e de remessa em garantia autorizada, referencia da chave original, itens carregados da origem, CFOP 5916/6916, CSOSN 400 e sem cobranca/pagamento (`tPag 90`).
- Rastreio de NF-e emitida: lista fiscal filtra por ambiente, mostra chave de acesso, indica disponibilidade de XML e separa download de DANFE/PDF e XML.
- Demais Remessa/Retorno na pagina completa: implementadas como rascunho guiado, com CFOP sugerido por finalidade e emissao bloqueada ate parametrizacao fiscal.
- Transferencia na pagina completa: implementada como rascunho guiado, com CFOP 5152/6152 sugerido e emissao bloqueada ate parametrizacao fiscal.
- Bonificacao/Brinde/Doacao na pagina completa: implementada como rascunho guiado, com CFOP 5910/6910 sugerido e emissao bloqueada ate parametrizacao fiscal.
- ICMS e IPI zerados no MVP: comportamento considerado coerente para venda comum de empresa Simples Nacional usando CSOSN 102, sem ST, sem permissao de credito e sem regra especifica de IPI.

Observacoes:
- O MVP atual nao cobre automaticamente ST, FCP, DIFAL, beneficio fiscal, CSOSN 101/201/202/500/900 ou cenarios industriais/equiparados.
- CPF/CNPJ valido do destinatario e obrigatorio para NF-e; CEP ou documento incompleto deve bloquear antes da transmissao.
- NFS-e nao deve depender de Inscricao Estadual; exigencia de IE fica restrita aos documentos de produto (NFC-e/NF-e).
- Na pagina completa, `Venda comum`, `Devolucao de compra` baseada em NF-e importada, `Remessa para conserto`, `Remessa em garantia`, `Retorno de conserto` e `Retorno de garantia` estao liberadas para emissao real nesta fase.
- Em Remessa/Retorno, `Remessa para conserto`, `Remessa em garantia`, `Retorno de conserto` e `Retorno de garantia` transmitem; as demais sugestoes de CFOP sao auxiliares de UX e nao liberam transmissao sem regra fiscal validada.
- Em Transferencia e Bonificacao/Brinde/Doacao, as sugestoes de CFOP sao auxiliares de UX e nao liberam transmissao sem regra fiscal validada.

## Tres Fluxos de Emissao de NF-e

### 1) NF-e Rapida de Venda (ja implementada)
Local:
- fluxo atual de emissao fiscal avulsa/baseada em OS

Caracteristicas:
- hardcoded para venda comum de produtos
- voltada ao dia a dia operacional
- usa regras rigidas de venda
- CFOP automatico:
  - 5102 para venda interna
  - 6102 para venda interestadual
- dentro/fora do estado calculado pelo endereco do destinatario
- validada em homologacao

Nao e objetivo deste fluxo:
- cobrir devolucao, remessa, transferencia, bonificacao ou operacoes complexas
- substituir a pagina completa de NF-e

### 2) NF-e de Devolucao por Nota Importada (ja existente)
Local:
- tela fiscal atual, dentro do fluxo/card de NF-e importada

Caracteristicas:
- hardcoded para devolucao baseada em XML/NF-e de entrada
- usa referencia da chave de acesso da nota original
- deve permanecer isolada e funcional

Regra de seguranca:
- nao alterar este fluxo durante a criacao da nova pagina completa, salvo correcao pontual explicitamente validada.

### 3) Pagina Completa de Emissao de NF-e (nova)
Local sugerido:
- `/fiscal/nfe`

Caracteristicas:
- fluxo livre/guiado para emitir NF-e em operacoes comuns e avancadas
- nao substitui a NF-e rapida de venda
- nao substitui a NF-e de devolucao por nota importada
- deve permitir maior controle fiscal, revisao e auditoria
- venda comum ja emite em homologacao usando o backend validado da NF-e rapida
- devolucao de compra usa a mesma acao backend aprovada em producao no fluxo de NF-e importada
- remessa para conserto ja possui acao backend propria para transmissao e foi validada em homologacao
- retorno de conserto ja possui acao backend propria para transmissao, pendente de validacao em homologacao

Esta e a proxima grande implementacao.

## Operacoes da Nova Pagina Completa
Criar uma UI guiada para os 5 grupos mais comuns:
- Venda (interna e interestadual)
- Devolucao de venda/compra
- Remessa/retorno para conserto, garantia, demonstracao ou industrializacao
- Transferencia entre filiais/depositos
- Bonificacao, brinde ou doacao

Tambem deve existir uma opcao:
- Outra operacao / avancado

No modo avancado, o usuario pode selecionar CFOP fora dos fluxos comuns, mas com validacoes minimas, bloqueios e auditoria.

## Principios de UI
- O usuario escolhe a natureza de negocio primeiro; CFOP aparece como consequencia tecnica.
- O sistema nao deve perguntar "dentro ou fora do estado"; deve calcular pelo endereco do destinatario.
- Para operacoes guiadas, CFOP nao deve ser digitavel livremente.
- Se houver mais de um CFOP possivel, mostrar apenas opcoes compativeis com o contexto.
- Operacoes fora dos 5 grupos entram pelo modo avancado.
- Emissao so ocorre apos checklist fiscal completo.
- Regras fiscais devem ser explicitas, auditaveis e bloqueantes quando o cenario nao estiver coberto.
- A UI deve evitar linguagem fiscal desnecessaria no inicio do fluxo e expor os detalhes tecnicos na revisao.

## Wizard da Nova Pagina Completa

### Etapa 1 - Tipo de Operacao
Opcoes:
- Venda
- Devolucao
- Remessa/Retorno
- Transferencia
- Bonificacao/Brinde/Doacao
- Outra operacao (avancado)

### Etapa 2 - Finalidade Especifica
Exemplos:
- Venda comum
- Devolucao de compra
- Devolucao de venda
- Remessa para conserto
- Retorno de conserto
- Remessa em garantia
- Retorno de garantia
- Remessa para demonstracao
- Retorno de demonstracao
- Transferencia entre filiais
- Bonificacao
- Brinde
- Doacao

### Etapa 3 - Participantes
Campos:
- destinatario/remetente
- CPF/CNPJ
- IE / indicador de contribuinte
- endereco completo
- email
- telefone

Regras:
- endereco completo e obrigatorio para NF-e
- UF do destinatario define operacao interna/interestadual/exterior
- documento invalido bloqueia antes da transmissao

### Etapa 4 - Itens
Campos por item:
- produto
- descricao
- NCM
- CFOP sugerido/validado
- CSOSN/CST
- unidade
- quantidade
- valor unitario
- valor total
- origem
- informacoes fiscais complementares quando aplicavel

Regras:
- NCM valido e obrigatorio
- tributacao calculada por item
- regras nao cobertas bloqueiam emissao com mensagem clara

### Etapa 5 - Transporte/Frete
Campos:
- `modFrete` (0/1/2/3/4/9)
- transportadora quando aplicavel
- CNPJ/CPF
- razao social
- IE
- endereco
- veiculo
- volumes

### Etapa 6 - Observacoes
Campos:
- observacoes comerciais (`infCpl`)
- observacoes fiscais (`infAdFisco`)

Regras:
- textos podem ser sugeridos por regra fiscal, mas devem ser revisaveis
- observacoes obrigatorias por cenario devem bloquear se ausentes

### Etapa 7 - Revisao Fiscal
Mostrar:
- natureza da operacao
- finalidade especifica
- interna/interestadual/exterior calculado
- CFOP final por item
- CSOSN/CST por item
- totais
- pendencias bloqueantes
- alertas nao bloqueantes
- limites do MVP quando aplicavel

Botao:
- `Auditar com IA`

### Etapa 8 - Previa Estilo DANFE
Objetivo:
- permitir conferencia visual fiel ao DANFE antes da emissao

Regra:
- a previa e somente uma representacao visual do rascunho
- edicoes acontecem em formulario/painel de campos, nao dentro do PDF
- ao salvar campo, backend persiste e revalida
- a previa e atualizada a partir dos dados persistidos
- o PDF final e gerado apenas no fim, com dados validados

### Etapa 9 - Emissao
Botao:
- `Emitir NF-e`

Regras:
- habilitado apenas sem pendencias bloqueantes
- confirmar ambiente (homologacao/producao)
- registrar payload, resultado e eventos de auditoria

## Tributacao e Motor de Regras
Implementar matriz de regras por cenario:
- tipo de operacao
- finalidade especifica
- UF origem x UF destino
- contribuinte x nao contribuinte
- Simples Nacional x outros regimes
- NCM
- CFOP
- CSOSN/CST
- ST/FCP/DIFAL/IPI/PIS/COFINS quando aplicavel

No inicio, criar versao "MVP fiscal seguro":
- cenarios suportados explicitamente
- cenarios nao suportados bloqueiam emissao
- bloqueio deve dizer qual regra falta parametrizar

## Auditoria por IA
Implementar assistente de auditoria antes da emissao:
- botao `Auditar com IA` na revisao fiscal
- IA le rascunho da NF-e + regras fiscais internas + cadastro do emitente/destinatario
- IA nao transmite nota
- IA nao decide emissao
- IA nao preenche automaticamente a nota nesta fase

Saida esperada:
- `Erros bloqueantes`
- `Alertas`
- `Sem inconsistencias relevantes`

Cada apontamento deve trazer:
- motivo
- campo afetado
- acao sugerida

## XML, PDF e Distribuicao
Para NF-e autorizada:
- XML `procNFe` salvo localmente
- PDF (DANFE) acessivel
- download de XML e PDF no painel
- envio por email com XML anexo
- log de envio e falha

## Modelo de Dados (Evolucao)

### Tabela `fiscal_invoices` (aproveitar existente)
Adicionar/confirmar campos:
- `operation_type` (`sale`, `return`, `shipment`, `transfer`, `bonus`, `donation`, etc.)
- `operation_group`
- `operation_purpose`
- `validation_errors` (json/text)
- `email_sent_at`
- `email_sent_to`
- `email_status`
- `email_error`
- `transport_payload` (json)
- `tax_snapshot` (json)
- `ai_audit_snapshot` (json)

### Tabela de regras fiscais (nova)
Sugestao: `fiscal_tax_rules`
- organizacao
- tipo_operacao
- finalidade
- uf_origem
- uf_destino
- contribuinte_destino (bool/null)
- ncm/faixa/natureza
- cfop
- csosn/cst
- parametros de ICMS/IPI/PIS/COFINS
- flags: st/fcp/difal
- prioridade
- ativo
- vigencia_inicio
- vigencia_fim

### Tabela de auditoria (nova)
Sugestao: `fiscal_invoice_events`
- invoice_id
- evento (`draft_created`, `validated`, `ai_audited`, `emitted`, `authorized`, `rejected`, `emailed`)
- payload/resposta
- created_at

## Arquitetura de Codigo

### Services / Server Actions
- `criarRascunhoNFe(payload)`
- `atualizarRascunhoNFe(invoiceId, patch)`
- `validarRascunhoNFe(invoiceId)` (nao transmite)
- `calcularTributosNFe(payload, regras)`
- `montarPayloadNFe(payload, contextoFiscal)`
- `auditarNFeComIA(invoiceId)`
- `emitirNFeCompleta(invoiceId)`
- `enviarNFeEmail(invoiceId, destinatarios)`

### UI
- nova rota `/fiscal/nfe`
- stepper com validacoes por etapa
- selecao guiada de operacao
- painel de pendencias
- revisao fiscal
- botao `Auditar com IA`
- previa estilo DANFE
- botao final `Emitir NF-e`

### Webhook / Polling
- reusar webhook atual da Nuvem Fiscal
- garantir update de XML/PDF/status para NF-e completa

## Fases de Implementacao

### Fase 1 - Estrutura da Nova Pagina
- Criar rota `/fiscal/nfe`
- Criar layout/stepper da emissao completa
- Implementar selecao dos 5 grupos de operacao + modo avancado
- Criar rascunho local/estado inicial sem transmissao

### Fase 2 - Dados Base e Validacoes Estruturais
- Participantes
- Endereco completo
- Itens com NCM
- Calculo interno/interestadual pelo endereco
- Checklist de pendencias bloqueantes

### Fase 3 - Regras Fiscais MVP
- Mapear cenarios suportados
- Sugerir/travar CFOP por cenario guiado
- Bloquear cenarios nao cobertos
- Registrar `tax_snapshot`

### Fase 4 - Transporte e Observacoes
- Implementar bloco de transporte/frete
- Implementar observacoes comerciais/fiscais
- Validar campos obrigatorios por operacao

### Fase 5 - Revisao + Previa DANFE
- Tela de revisao fiscal
- Previa estilo DANFE baseada em dados persistidos/validados
- Edicao fora do PDF com revalidacao no backend

### Fase 6 - Auditoria por IA
- Implementar `Auditar com IA`
- Persistir resultado em evento/snapshot
- Mostrar erros, alertas e mensagem de consistencia

### Fase 7 - Emissao Completa
- Montar payload final
- Integrar `infRespTec` com RT/CSRT correto
- Emitir em homologacao
- Salvar XML/PDF/status

### Fase 8 - Endurecimento
- Testes automatizados
- Monitoramento de rejeicoes por codigo
- Auditoria de eventos
- Envio de XML/PDF por email

## Checklist de Producao
- [ ] Fluxos hardcoded atuais preservados
- [ ] NF-e rapida de venda sem regressao
- [ ] NF-e de devolucao por nota importada sem regressao
- [ ] Nova pagina `/fiscal/nfe` criada
- [ ] 5 grupos de operacao implementados na UI
- [ ] Modo avancado implementado com bloqueios
- [ ] Regras fiscais documentadas por cenario suportado
- [ ] Emissao em homologacao sem rejeicoes nos cenarios MVP
- [ ] XML autorizado armazenado e baixavel
- [ ] PDF/DANFE acessivel
- [ ] Email com XML funcionando e rastreado
- [ ] Revisao fiscal obrigatoria antes de emitir
- [ ] Auditoria por IA ativa antes da emissao
- [ ] Logs de auditoria completos

## Riscos e Mitigacao

Risco: regressao na NF-e rapida de venda.
Mitigacao: manter fluxo atual isolado e testar NFC-e/NFS-e/NF-e rapida antes de publicar.

Risco: regressao na NF-e de devolucao.
Mitigacao: nao alterar tela/handler atual de devolucao durante a criacao da nova pagina.

Risco: regras fiscais incompletas.
Mitigacao: bloquear emissao fora dos cenarios suportados, com mensagens claras.

Risco: usuario escolher CFOP incorreto no modo avancado.
Mitigacao: limitar escolhas por entrada/saida, UF, finalidade e registrar justificativa/auditoria.

Risco: credenciais RT/CSRT inconsistentes por ambiente.
Mitigacao: validacao explicita por ambiente e teste de emissao controlado.

## Proximo Passo Recomendado
Parametrizar a devolucao na nova pagina completa reaproveitando o fluxo ja validado de NF-e de entrada: selecionar nota importada, carregar itens da origem e espelhar impostos/taxas proporcionalmente.
