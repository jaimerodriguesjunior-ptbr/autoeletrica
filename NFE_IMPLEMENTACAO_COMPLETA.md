# Plano Completo de Implementacao - NF-e (Modelo 55)

## Objetivo
Criar uma pagina completa de emissao de NF-e (modelo 55), separada dos fluxos rapidos ja existentes, capaz de conduzir o usuario pelas operacoes fiscais mais comuns com seguranca, validacao, revisao tecnica e transmissao controlada.

A ideia do produto e ter dois tipos de experiencia:
- fluxos simplificados/templates para operacoes comuns, com regras rigidas e pouco atrito para o usuario;
- operacao assistida para casos fora do padrao, com campos tecnicos livres, validacao estrutural e apoio de IA/contador antes de qualquer emissao real.

## Estado Atual
- Ja existe emissao de NFC-e e NFS-e no fluxo fiscal atual.
- Ja existe NF-e rapida de venda no fluxo atual de emissao avulsa/baseada em OS.
- Ja existe NF-e de devolucao a partir de NF-e importada.
- Ja existe integracao com Nuvem Fiscal, webhook, armazenamento de XML/PDF e proxy de impressao.
- NF-e rapida de venda foi validada em homologacao para venda interna e interestadual.
- A nova pagina completa `/fiscal/nfe` ja existe e emite os principais templates implementados.

## Fluxos de Emissao de NF-e

### 1) NF-e Rapida de Venda
Local:
- fluxo atual de emissao fiscal avulsa/baseada em OS.

Caracteristicas:
- hardcoded para venda comum de produtos;
- voltada ao dia a dia operacional;
- usa regras rigidas de venda;
- CFOP automatico: `5102` para venda interna e `6102` para venda interestadual;
- dentro/fora do estado calculado pelo endereco do destinatario;
- bloqueio de duplicidade apenas contra outra NF-e da mesma OS, sem bloquear NFC-e.

Nao e objetivo deste fluxo:
- cobrir devolucao, remessa, transferencia, bonificacao ou operacoes complexas;
- substituir a pagina completa de NF-e.

### 2) NF-e de Devolucao por Nota Importada
Local:
- tela fiscal atual, dentro do fluxo/card de NF-e importada.

Caracteristicas:
- hardcoded para devolucao baseada em XML/NF-e de entrada;
- usa referencia da chave de acesso da nota original;
- espelha impostos/taxas da nota de origem conforme o fluxo ja validado;
- deve permanecer isolada e funcional.

Regra de seguranca:
- nao alterar este fluxo salvo correcao pontual explicitamente validada.

### 3) Pagina Completa de Emissao de NF-e
Local:
- `/fiscal/nfe`.

Caracteristicas:
- fluxo guiado para operacoes comuns;
- fluxo assistido para operacao livre orientada pelo contador;
- nao substitui a NF-e rapida de venda;
- nao substitui a NF-e de devolucao por nota importada;
- permite revisao tecnica antes da emissao;
- exige validacao do rascunho antes de transmitir;
- mostra previa estilo DANFE, mas as edicoes sao feitas nos formularios e revalidadas antes da emissao.
- permite clonar uma NF-e existente apenas como pre-preenchimento da UI, sem copiar numero, chave, protocolo ou status.

## Operacoes da Pagina Completa

### Venda
Status:
- implementada com emissao real.

Regras principais:
- CFOP automatico `5102`/`6102` conforme UF do destinatario;
- natureza padrao `VENDA DE MERCADORIA`;
- usa CSOSN padrao `102` para empresa Simples Nacional;
- permite parametros tecnicos controlados por item quando orientado pelo contador.

### Devolucao de Compra
Status:
- implementada chamando o backend de devolucao ja aprovado no fluxo de NF-e importada.

Regras principais:
- exige NF-e de origem importada/autorizada;
- exige chave de acesso valida;
- carrega itens da origem;
- emite com finalidade de devolucao (`finNFe=4`);
- preserva a logica cirurgica do fluxo ja validado.

### Remessa/Retorno para Conserto
Status:
- remessa para conserto implementada com emissao real;
- retorno de conserto implementado com emissao real.

Regras principais:
- remessa usa CFOP `5915`/`6915` conforme UF;
- retorno usa NF-e de remessa autorizada como origem;
- retorno referencia a chave da remessa original;
- itens do retorno sao carregados da nota de origem;
- sem cobranca/pagamento (`tPag=90`);
- CSOSN padrao `400`.

### Remessa/Retorno em Garantia
Status:
- remessa em garantia implementada com emissao real;
- retorno de garantia implementado com emissao real.

Regras principais:
- remessa usa CFOP `5915`/`6915` conforme UF, com natureza e observacao de garantia;
- retorno usa NF-e de remessa em garantia autorizada como origem;
- retorno referencia a chave da remessa original;
- itens do retorno sao carregados da nota de origem;
- sem cobranca/pagamento (`tPag=90`);
- CSOSN padrao `400`.

### Transferencia
Status:
- implementada com emissao real para os cenarios parametrizados.

Finalidades atuais:
- transferencia entre filiais;
- transferencia para deposito;
- retorno de deposito.

Regras principais:
- CFOP sugerido/travado conforme finalidade e UF;
- `Transferencia entre filiais` usa `5152/6152`; `Retorno de deposito` usa `5153/6153`;
- transferencia entre filiais exige mesma raiz de CNPJ entre emitente e destinatario;
- quando a finalidade for de deposito e a raiz do CNPJ for diferente, a UI mostra alerta para conferencia contabil;
- sem cobranca/pagamento (`tPag=90`);
- CSOSN padrao `400`.

### Bonificacao, Brinde e Doacao
Status:
- implementadas com emissao real para os cenarios parametrizados.

Regras principais:
- CFOP `5910`/`6910` conforme UF;
- natureza ajustada conforme finalidade;
- sem cobranca/pagamento (`tPag=90`);
- CSOSN padrao `400`;
- observacao fiscal/comercial gerada pelo template e revisavel.

### Outra Operacao Assistida
Status:
- implementada como operacao livre assistida.

Regras principais:
- usuario informa natureza da operacao, CFOP, finalidade, entrada/saida e parametros fiscais com orientacao do contador;
- motor interno faz validacao estrutural;
- IA roda automaticamente no momento de emissao da operacao assistida (sem botao dedicado);
- IA nao transmite nota, nao decide sozinha e nao substitui contador;
- emissao real fica controlada: exige confirmacao de revisao do contador e fica limitada a homologacao nesta fase.

## Principios de UI
- O usuario escolhe a natureza de negocio primeiro; CFOP aparece como consequencia tecnica.
- O sistema nao pergunta dentro/fora do estado; calcula pela UF do participante.
- Para operacoes guiadas, CFOP fica rigido/travado conforme template.
- Operacoes fora dos templates entram em `Outra operacao assistida`.
- A emissao so ocorre depois de validacao tecnica.
- Campos tecnicos alterados geram aviso antes da transmissao.
- A previa estilo DANFE e somente visual; edicoes acontecem nos campos do formulario.
- A IA aparece como auditoria assistiva apenas na operacao livre, chamada junto da validacao.
- Clonar nota e atalho de preenchimento, nao reaproveitamento automatico de emissao.

## Clonagem de NF-e
Status:
- implementada na pagina completa de NF-e como pre-preenchimento conservador.
- reativada apos regressao de UI (texto/fluxo) para manter botao e modal de clonagem operacionais.

Regras:
- botao `Clonar nota` abre modal com filtros por ambiente, status e busca por numero/cliente/documento/chave;
- cards de clonagem mostram resumo fiscal rapido por nota (itens, CFOP, origem/CSOSN/CST, IPI, PIS e COFINS) para acelerar os testes;
- ao selecionar uma nota, a UI e preenchida com participante, itens, transporte, pagamento, totais, observacoes e parametros fiscais disponiveis no payload;
- numero, serie da emissao original, chave de acesso, protocolo, status e datas oficiais nao sao reaproveitados para a nova emissao;
- o rascunho clonado sempre exige nova validacao antes de emitir;
- devolucao/retorno clonados ainda exigem origem fiscal e por isso nao sao clonados automaticamente nesta fase.

## Wizard da Pagina Completa

### Etapa 1 - Operacao
Opcoes:
- Venda;
- Devolucao;
- Remessa/Retorno;
- Transferencia;
- Bonificacao/Brinde/Doacao;
- Outra operacao assistida.

### Etapa 2 - Participante/Origem
Para operacoes comuns:
- buscar cliente/participante cadastrado;
- preencher endereco completo;
- validar CPF/CNPJ (com digito verificador), UF, CEP e codigo de municipio.

Para devolucao/retorno:
- selecionar NF-e de origem;
- carregar chave de acesso;
- carregar itens da origem.

### Etapa 3 - Itens
Campos principais:
- produto/peca do banco;
- descricao;
- NCM;
- CFOP;
- unidade;
- quantidade;
- valor unitario;
- valor total;
- origem fiscal;
- CSOSN/CST.

Campos de tributacao controlada:
- cBenef;
- IPI CST;
- IPI cEnq;
- IPI base;
- IPI aliquota;
- IPI valor;
- PIS CST/base/aliquota/valor;
- COFINS CST/base/aliquota/valor.

Regras:
- NCM valido e obrigatorio;
- valores fiscais negativos bloqueiam;
- alteracoes tecnicas relevantes geram alerta antes da emissao.

### Etapa 4 - Transporte, Pagamento e Totais
Campos:
- `modFrete`;
- transportadora quando aplicavel;
- placa/UF do veiculo quando aplicavel;
- volumes;
- forma de pagamento;
- indicador de presenca;
- intermediador quando aplicavel;
- frete;
- seguro;
- desconto;
- outras despesas.

Regras:
- frete, seguro, desconto e outras despesas entram no total da NF-e;
- valores adicionais sao distribuidos proporcionalmente nos itens;
- operacoes sem cobranca usam `tPag=90` e `vPag=0`;
- venda comum usa valor final da nota no pagamento.
- transportadora com `modFrete` diferente de `9` exige CPF/CNPJ valido (nao apenas tamanho).

### Etapa 5 - Revisao Fiscal
Mostra:
- natureza da operacao;
- finalidade especifica;
- classificacao interna/interestadual;
- CFOP por item;
- CSOSN/CST por item;
- totais;
- pendencias bloqueantes;
- alerta de parametros tecnicos alterados;
- auditoria por IA quando for operacao assistida.

Acoes:
- `Validar NF-e`;
- depois da validacao, `Emitir NF-e` ou `Emitir NF-e assistida` conforme caso.

## Motor Fiscal Atual

### Regime Tributario
- O motor novo de NF-e esta liberado apenas para empresas do Simples Nacional (`CRT=1`).
- Se a empresa estiver em Regime Normal, a emissao e bloqueada porque exigiria CST/ICMS proprio (`ICMS00`, `ICMS20`, `ICMS40`, etc.).

### ICMS
- Venda comum usa `ICMSSN102` por padrao.
- Remessa, retorno, transferencia, bonificacao, brinde e doacao usam CSOSN padrao `400` quando nao ha tributacao destacada.
- Devolucao reaproveita a logica do fluxo ja aprovado e pode usar `ICMSSN900` quando espelha ICMS da origem.

### IPI
- O motor diferencia IPI tributado e nao tributado.
- CSTs tributados suportados geram `IPITrib`.
- CSTs nao tributados/suspensos suportados geram `IPINT`.
- `cEnq` foi exposto no item e enviado no payload; padrao `999` quando nao preenchido.

### PIS/COFINS
- Campos controlados por item.
- Padrao atual usa CST `99` com base/aliquota/valor zerados quando nao informado.

### Totais
- `vFrete`, `vSeg`, `vDesc` e `vOutro` entram no `ICMSTot`.
- `vNF` considera: produtos + frete + seguro + outras despesas + IPI - desconto.
- Frete/seguro/desconto/outras despesas sao rateados proporcionalmente nos itens.

### Numeracao e Serie
- NF-e usa sequencia atomica no banco via RPC `get_next_nfe_number`.
- A tabela `nfe_sequences` controla numero por empresa, serie e ambiente.
- A serie padrao de NF-e fica em `company_settings.nfe_serie`.
- A tela de configuracoes da empresa permite editar a serie padrao da NF-e.

### Responsavel Tecnico
- NF-e e NFC-e usam o mesmo resolvedor de responsavel tecnico.
- O RT deve representar a software house responsavel, atualmente Mente Binaria, e nao a empresa emitente.
- A resolucao prioriza campos da empresa (`rt_cnpj`, `responsavel_tecnico_cnpj`, `rt_contato`, `rt_email`, `rt_fone`) e depois variaveis `.env` (`NFE_RT_CNPJ`, `NFE_RT_CONTATO`, `NFE_RT_EMAIL`, `NFE_RT_FONE`).
- `idCSRT` e `CSRT` continuam sendo enviados quando configurados para o ambiente.

## Inutilizacao
- A tela de fechamento/financeiro permite inutilizar numeracao fiscal para `NFCe` e `NFe`.
- A inutilizacao usa endpoint adequado conforme modelo (`nfce` ou `nfe`).
- O historico e os comprovantes registram o modelo fiscal.
- O ZIP/fechamento inclui inutilizacoes de NFC-e e NF-e.

## XML, PDF e Distribuicao
Status atual:
- lista fiscal separa PDF/DANFE e XML;
- lista fiscal filtra por ambiente;
- XML autorizado pode ser baixado pela tela fiscal;
- quando XML ainda nao esta salvo, a atualizacao automatica tenta buscar e persistir o XML das notas visiveis em homologacao e producao;
- download manual de XML tambem persiste `xml_content` quando possivel e atualiza a tela apos o clique;
- o indicador azul de XML depende de `xml_content` salvo no banco, nao apenas de `xml_url`.

Ainda desejavel:
- envio de DANFE/XML por email direto pela tela;
- log de envio de email;
- acao de compartilhar por WhatsApp com resumo e anexos, se fizer sentido no produto.

## Auditoria por IA
Status atual:
- IA nao e usada para emitir nota;
- IA nao preenche nota automaticamente;
- IA e usada na validacao da `Outra operacao assistida`;
- o botao manual `Auditar com IA` foi removido do fluxo principal;
- ao clicar em `Validar NF-e`, o motor interno valida primeiro e, se for operacao assistida, chama a IA em seguida;
- a resposta da IA e formatada em linguagem de usuario, com resumo, pontos encontrados, sugestoes e perguntas para o contador;
- existe texto copiavel para enviar ao contador.

Papel correto da IA:
- apontar incoerencias semanticas, como natureza de operacao incompatavel com CFOP;
- sugerir perguntas para o contador;
- explicar se o rascunho parece coerente para a finalidade declarada;
- nunca substituir validacao oficial da SEFAZ, regra fiscal parametrizada ou revisao do contador.
- documentos (CPF/CNPJ) e campos estruturais sao validados de forma deterministica pelo sistema antes do envio.

## Migracoes Relacionadas
- `migration_nfe_sequence.sql`: cria controle atomico de numeracao NF-e por empresa/serie/ambiente e RPC `get_next_nfe_number`.
- `migration_company_settings_nfe_serie.sql`: adiciona `company_settings.nfe_serie` com padrao `1` e constraint positiva.

## Validacoes Tecnicas Rodadas
- `npx tsc --noEmit`: passou.
- `npm run lint`: passou.
- `npm run build`: passou apos limpar cache `.next` corrompido.

Avisos nao bloqueantes:
- `baseline-browser-mapping` desatualizado;
- `caniuse-lite`/Browserslist desatualizado.

## Checklist de Teste em Homologacao

### Venda Comum
- [ ] Emitir venda simples sem frete/desconto/adicionais.
- [ ] Confirmar CFOP `5102` para participante do mesmo estado.
- [ ] Confirmar CFOP `6102` para participante de outro estado.
- [ ] Confirmar XML salvo automaticamente na lista fiscal.
- [ ] Confirmar DANFE/PDF baixavel.

### Venda com Frete
- [ ] Informar frete no transporte.
- [ ] Validar que `vFrete` aparece no total da NF-e.
- [ ] Validar que o total da nota soma produtos + frete.
- [ ] Confirmar autorizacao em homologacao.

### Venda com Desconto
- [ ] Informar desconto.
- [ ] Validar que `vDesc` aparece no total da NF-e.
- [ ] Validar que o total da nota subtrai o desconto.
- [ ] Confirmar autorizacao em homologacao.

### Venda com IPI Tributado
- [ ] Preencher IPI CST tributado, exemplo `99`.
- [ ] Preencher IPI base, aliquota, valor e cEnq.
- [ ] Validar que a nota autoriza.
- [ ] Conferir no XML se saiu `IPITrib`.

### Venda com IPI Nao Tributado/Suspenso
- [ ] Preencher CST de IPI nao tributado/suspenso, exemplo orientado pelo contador.
- [ ] Validar que a nota autoriza sem base/aliquota indevida.
- [ ] Conferir no XML se saiu `IPINT`.

### Clonagem de NF-e
- [ ] Abrir `Clonar nota` na pagina completa de NF-e.
- [ ] Filtrar por ambiente, status e busca textual.
- [ ] Selecionar uma NF-e existente e confirmar que a UI foi preenchida como rascunho.
- [ ] Confirmar que numero, serie original, chave, protocolo, status e autorizacao nao foram reaproveitados.
- [ ] Validar novamente antes de qualquer tentativa de emissao.
- [ ] Confirmar que devolucao/retorno continuam exigindo origem fiscal especifica.

### Remessa e Retorno em Garantia
- [ ] Emitir remessa em garantia.
- [ ] Confirmar que aparece na lista de origens do retorno de garantia.
- [ ] Emitir retorno de garantia referenciando a remessa.
- [ ] Confirmar chave referenciada no DANFE/XML.
- [ ] Confirmar itens carregados da origem.

### Remessa e Retorno para Conserto
- [ ] Emitir remessa para conserto.
- [ ] Confirmar que aparece na lista de origens do retorno de conserto.
- [ ] Emitir retorno de conserto referenciando a remessa.
- [ ] Confirmar chave referenciada no DANFE/XML.

### Transferencia
- [ ] Testar transferencia entre filiais com mesma raiz de CNPJ.
- [ ] Confirmar bloqueio quando a raiz de CNPJ for diferente.
- [ ] Testar transferencia para deposito.
- [ ] Testar retorno de deposito.
- [ ] Confirmar que a tela nao exibe mensagem de operacao bloqueada quando a finalidade de transferencia estiver habilitada no MVP.

### Bonificacao, Brinde e Doacao
- [ ] Emitir bonificacao.
- [ ] Emitir brinde.
- [ ] Emitir doacao.
- [ ] Conferir natureza da operacao e CFOP no DANFE/XML.
- [ ] Confirmar que a tela nao exibe mensagem de operacao bloqueada quando a finalidade estiver habilitada no MVP.

### Outra Operacao Assistida
- [ ] Criar rascunho de remessa para demonstracao com CFOP incorreto propositalmente.
- [ ] Clicar em `Validar NF-e`.
- [ ] Confirmar que a IA aponta incoerencia entre natureza e CFOP.
- [ ] Corrigir CFOP conforme orientacao do contador.
- [ ] Validar novamente.
- [ ] Confirmar que a emissao assistida exige revisao do contador e fica restrita a homologacao.

### Inutilizacao NF-e
- [ ] Inutilizar uma faixa de NF-e em homologacao.
- [ ] Confirmar registro na tela de fechamento.
- [ ] Baixar comprovante JSON/PDF.
- [ ] Confirmar que o modelo aparece como `NFe`, nao `NFCe`.

## Checklist Antes de Producao
- [ ] Fluxos hardcoded atuais preservados.
- [ ] NF-e rapida de venda sem regressao.
- [ ] NF-e de devolucao por nota importada sem regressao.
- [ ] NFC-e e NFS-e sem regressao.
- [ ] Migrations aplicadas em producao com conferencia de dados.
- [ ] Serie NF-e configurada por empresa.
- [ ] Sequencia NF-e inicial conferida por empresa/serie/ambiente.
- [ ] Testes de homologacao acima executados.
- [ ] XML autorizado armazenado e baixavel.
- [ ] PDF/DANFE acessivel.
- [ ] Operacao assistida limitada conforme politica decidida.
- [ ] Contador validou os templates fiscais que serao usados em producao.

## Riscos e Mitigacao

Risco: regressao na NF-e rapida de venda.
Mitigacao: manter fluxo atual isolado e testar NFC-e/NFS-e/NF-e rapida antes de publicar.

Risco: regressao na NF-e de devolucao.
Mitigacao: preservar handler aprovado e testar com NF-e de entrada real em ambiente apropriado.

Risco: regras fiscais incompletas.
Mitigacao: bloquear emissao fora dos cenarios suportados ou mover para operacao assistida em homologacao.

Risco: usuario escolher CFOP incorreto no modo assistido.
Mitigacao: motor interno valida estrutura, IA aponta incoerencias semanticas e emissao exige revisao do contador.

Risco: numeracao incorreta em producao.
Mitigacao: usar sequencia atomica, configurar serie por empresa e conferir ultimo numero antes de liberar.

Risco: Regime Normal tentar emitir no motor do Simples Nacional.
Mitigacao: bloqueio explicito para CRT diferente de `1` ate implementar CST/ICMS de Regime Normal.

## Proximo Passo Recomendado
Executar o checklist de homologacao, priorizando venda simples, venda com frete/desconto, venda com IPI, remessa/retorno em garantia, operacao assistida e inutilizacao de NF-e.
