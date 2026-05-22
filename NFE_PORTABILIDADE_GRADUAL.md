# Estrategia de Portabilidade Gradual do Motor Fiscal

## Objetivo
Documentar a estrategia segura para reaproveitar a implementacao de NF-e/NFC-e/NFS-e da autoeletrica em outros sistemas, sem criar neste momento uma API fiscal centralizada.

A decisao atual e priorizar estabilidade operacional: validar primeiro na autoeletrica, levar para producao com cuidado e depois copiar/adaptar para outros sistemas um por vez.

## Decisao Arquitetural Atual
Nao criar uma API fiscal central agora.

Motivos:
- o dominio fiscal e sensivel;
- uma API central viraria ponto unico de falha;
- se algo quebrar, todos os sistemas poderiam ser afetados ao mesmo tempo;
- o projeto e mantido por uma pessoa so;
- ainda precisamos aprender com uso real em homologacao e producao;
- a experiencia real vai mostrar melhor quais partes devem virar biblioteca ou API no futuro.

A estrategia atual sera:
1. estabilizar na autoeletrica;
2. documentar arquivos, migrations, variaveis e testes;
3. copiar para um sistema por vez;
4. homologar com calma;
5. publicar somente depois de validacao fiscal e operacional.

## Ordem Planejada

### 1) Autoeletrica
Papel:
- laboratorio principal;
- primeiro sistema com a nova pagina completa de NF-e;
- primeiro sistema a validar venda, devolucao, remessa/retorno, transferencia, bonificacao/doacao, XML, PDF, inutilizacao e operacao assistida.

Objetivo antes de copiar:
- homologacao validada;
- producao validada com uso real controlado;
- checklist de testes executado;
- principais erros de usuario mapeados;
- fluxo de XML/PDF estabilizado;
- migrations conferidas.

### 2) Apoio-Contabil
Papel:
- primeiro sistema destino da copia/adaptacao;
- sistema feito sob medida para um contador;
- ambiente ideal para validacao contabil e fiscal mais criteriosa.

Motivo para ser o primeiro destino:
- o usuario principal entende o contexto fiscal;
- pode validar CFOP, natureza da operacao, CSOSN/CST, observacoes e comportamentos contabeis;
- pode ajudar a transformar os templates em regras mais confiaveis;
- pode apontar inconsistencias antes de levar para sistemas menos tecnicos, como oticas.

Objetivo no apoio-contabil:
- adaptar a UI para um usuario contador;
- manter a logica fiscal copiada da autoeletrica;
- revisar contabilmente cada template;
- registrar ajustes fiscais necessarios;
- separar o que e regra geral do que e regra especifica da autoeletrica.

### 3) Sistemas de Otica
Papel:
- copiar/adaptar depois que autoeletrica e apoio-contabil estiverem estaveis.

Cuidados:
- produtos, NCMs e operacoes podem ser diferentes;
- pode haver particularidades de venda presencial, internet, intermediador, garantia, remessa e devolucao;
- contador deve validar os templates antes de producao.

### 4) Emissores Fiscais Dedicados
Papel:
- sistemas mais genericos;
- devem receber a implementacao somente depois da maturidade dos fluxos anteriores.

Cuidados:
- por serem mais livres, exigem mais campos tecnicos;
- precisam de operacao assistida mais forte;
- devem ter documentacao clara para contador/usuario avancado.

## Principio Central
Cada sistema deve ser estabilizado antes de copiar para o proximo.

Nao queremos corrigir um bug fiscal em quatro sistemas ao mesmo tempo enquanto usuarios diferentes reclamam de problemas parecidos.

A copia gradual reduz risco porque:
- limita o numero de usuarios afetados;
- permite aprender com um contexto antes de ir ao proximo;
- evita que uma mudanca central derrube todos;
- facilita suporte por uma pessoa so.

## Base Semantica Comum (Decisao Explicita)
Mesmo sem API fiscal central neste momento, os sistemas devem compartilhar a mesma base semantica.

Isso significa:
- regras de negocio com a mesma intencao fiscal;
- mesmos criterios de validacao estrutural antes da emissao;
- mesmas nomenclaturas-chave de fluxo (operacao, participante, itens, transporte, revisao);
- mesmas mensagens criticas para orientar o usuario em erros e bloqueios;
- mesmo checklist de homologacao para evitar regressao silenciosa.

Em resumo:
- a execucao continua local por sistema (isolamento de risco);
- a semantica continua comum entre sistemas (portabilidade de correcao).

Objetivo pratico:
- o que for corrigido na autoeletrica deve ser reaplicado com baixo atrito nos demais programas;
- reduzir divergencia funcional ao longo do tempo, mesmo com codigo separado;
- manter previsibilidade para suporte, contador e validacao fiscal.

## Contrato Semantico Que Deve Ser Mantido
Ao portar a tela de NF-e para outro sistema, a primeira preocupacao nao deve ser copiar pixels ou nomes internos de arquivos. A primeira preocupacao deve ser manter o mesmo contrato mental do fluxo.

O fluxo sempre deve preservar estes passos:
1. Operacao.
2. Participante.
3. Itens.
4. Transporte e observacoes.
5. Revisao.

Significado de cada passo:
- `Operacao`: define a intencao fiscal inicial, template ou modo assistido.
- `Participante`: define destinatario/remetente e dados de endereco/IE.
- `Itens`: define produtos, NCM, CFOP, origem, CSOSN/CST e impostos por item.
- `Transporte e observacoes`: define frete, presenca da operacao, intermediador, pagamento, valores acessorios e observacoes.
- `Revisao`: consolida pendencias, regra atual, previa e auditoria por IA quando aplicavel.

Esse contrato deve existir mesmo que a UI de outro sistema seja visualmente diferente.

### Tipos de Operacao Padrao
A implementacao atual trabalha com estes grupos:
- `sale`: venda comum.
- `return`: devolucao de compra baseada em NF-e de entrada.
- `shipment`: remessa/retorno (conserto, garantia, demonstracao, industrializacao quando aplicavel).
- `transfer`: transferencia entre filiais/depositos e retorno de deposito.
- `bonus`: bonificacao, brinde e doacao.
- `advanced`: outra operacao, com orientacao do contador.

Ao portar, mantenha esses conceitos mesmo que o texto da tela seja adaptado ao dominio do novo sistema.

## Arquitetura Local Que Deve Ser Portada
Na autoeletrica, a NF-e completa esta distribuida principalmente nestas camadas:

- UI principal: `app/(admin)/fiscal/nfe/page.tsx`
- Emissao fiscal: `src/actions/fiscal_emission.ts`
- Wrappers/actions de UI: `src/actions/fiscal_emission_actions.ts`
- Banco e leitura de notas/XML: `src/actions/fiscal_db.ts`
- Auditoria por IA: `src/actions/fiscal_ai_audit.ts`
- Listagem/portal fiscal: `app/(admin)/fiscal/page.tsx`
- Configuracoes da empresa: `app/(admin)/configuracoes/page.tsx`

Portar apenas a tela nao e suficiente. A tela depende do contrato das actions, do banco, da numeracao, das configuracoes da empresa e das rotas de download/impressao.

## Campos Funcionais Que Devem Existir
Os sistemas destino precisam oferecer dados equivalentes a estes, mesmo que o banco tenha nomes diferentes.

### Empresa
- CNPJ/CPF.
- Razao social e nome fantasia.
- Inscricao estadual.
- Inscricao municipal.
- Regime tributario/CRT.
- CNAE para NFS-e, sem tratar CNAE como bloqueio de preenchimento de NF-e.
- Endereco completo com codigo IBGE.
- Serie padrao da NF-e.
- Credenciais Nuvem Fiscal.
- Responsavel tecnico da software house.

### Participante
- Nome/razao social.
- CPF/CNPJ.
- Indicador IE (`indIEDest`).
- Inscricao estadual quando houver.
- Email/telefone.
- Endereco completo com codigo IBGE.

### Itens
- Codigo.
- Descricao.
- NCM.
- CFOP.
- Unidade.
- Quantidade.
- Valor unitario/total.
- Origem.
- CSOSN/CST.
- CEST/cBenef quando aplicavel.
- IPI (`CST`, `cEnq`, base, aliquota, valor).
- PIS (`CST`, base, aliquota, valor).
- COFINS (`CST`, base, aliquota, valor).

### Transporte, Pagamento e Parametros da Operacao
- `modFrete`.
- Transportadora, documento e volumes quando houver transporte.
- `indPres` (presencial, internet, outros).
- `indIntermed` e dados do intermediador.
- `indFinal`.
- `meio_pagamento`.
- Frete, seguro, desconto e outras despesas.
- Observacoes comerciais (`infCpl`).
- Observacoes fiscais (`infAdFisco`).

## Regras de UX Que Devem Ser Preservadas
A tela foi desenhada para reduzir erro fiscal sem transformar a emissao em uma parede tecnica.

Regras importantes:
- Pendencias bloqueantes devem aparecer antes da transmissao.
- O menu lateral deve indicar tambem o passo onde a correcao acontece.
- A revisao pode manter alerta geral, mas o passo especifico tambem precisa alertar.
- Campo tecnico deve aparecer apenas onde ele ajuda a decidir ou corrigir.
- Textos para usuario devem ser simples; termos tecnicos ficam quando forem inevitaveis.
- Operacoes sem template devem orientar o usuario para `Outra operacao`.
- `Outra operacao` exige reforco visual de que o contador deve orientar a emissao.
- Auditoria por IA nao substitui contador e nao deve virar autorizacao fiscal.

Exemplo de regra objetiva que deve ficar em pendencias, nao depender da IA:
- venda de saida com `indPres = 0` deve alertar antes da auditoria.
- `modFrete = 9` com valor de frete maior que zero deve alertar.
- intermediador marcado como ativo exige CNPJ valido.
- desconto nao pode ser maior que o total dos itens.

## Templates e Reenquadramento Apos Clonagem
A clonagem de NF-e nao significa reaproveitar a nota anterior como documento fiscal. Ela serve para reaproveitar dados operacionais.

Dados que podem ser reaproveitados:
- participante;
- endereco;
- itens;
- valores de itens;
- NCM/unidade;
- observacoes quando a operacao continuar no mesmo template.

Dados que nao devem ser reaproveitados como identidade fiscal:
- numero da nota;
- chave de acesso;
- protocolo;
- status;
- autorizacao;
- data de autorizacao;
- qualquer identificador de emissao anterior.

Comportamento esperado:
- se o usuario clonar uma venda e continuar em venda, pode manter mais campos.
- se o usuario clonar uma venda e trocar para bonificacao/doacao/remessa/transferencia, o sistema deve reaplicar o template fiscal da nova operacao.
- o template novo deve recalcular ou limpar pagamento, `indPres`, `indIntermed`, `indFinal`, intermediador, CSOSN padrao, observacoes e valores acessorios quando necessario.
- a clonagem deve reduzir retrabalho, nao congelar a nota antiga.

Exemplo:
- usuario clona uma venda para o mesmo cliente;
- troca tipo de operacao para `Doacao`;
- sistema mantem cliente e itens;
- sistema troca pagamento para sem pagamento;
- sistema troca observacao para texto de doacao;
- sistema reaplica CSOSN/CFOP do template;
- sistema nao reaproveita numero/chave/protocolo da venda original.

## Nota de Origem e Referencias
Algumas operacoes precisam ou podem referenciar uma NF-e anterior.

Casos obrigatorios:
- devolucao de compra;
- retorno de conserto;
- retorno de garantia;
- retorno de deposito;
- outros retornos com template especifico.

Casos opcionais:
- `Outra operacao`, quando o contador orientar referencia a uma nota anterior.

Comportamento esperado:
- em operacoes obrigatorias, sem nota de origem a emissao deve ficar bloqueada.
- em `Outra operacao`, a nota de origem deve ser opcional.
- quando selecionada, a chave da nota de origem deve ir em `NFref`.
- em `Outra operacao`, selecionar nota de origem nao deve necessariamente substituir os itens atuais.
- nos fluxos de devolucao/retorno com template, a nota de origem pode alimentar os itens e quantidades retornadas.

Essa diferenca e importante:
- devolucao/retorno usa nota de origem como base operacional;
- outra operacao pode usar nota de origem apenas como referencia fiscal.

## Operacao Assistida e Auditoria por IA
`Outra operacao` existe para operacoes sem template ou com parametrizacao orientada pelo contador.

Regras:
- deve ficar limitada a homologacao enquanto nao houver maturidade suficiente para producao;
- deve permitir preencher natureza, tipo NF-e, finalidade, CFOP, impostos e observacoes;
- deve permitir nota de origem opcional;
- deve enviar para a IA o payload completo da operacao, incluindo parametros de presenca, pagamento, intermediador e valores acessorios;
- deve ter botao para enviar resumo ao contador por WhatsApp quando houver duvida;
- deve exigir confirmacao explicita antes de emitir quando a auditoria apontar pontos de atencao.

Escopo da IA:
- auditar consistencia de preenchimento da NF-e;
- nao decidir se a empresa pode ou nao emitir pela atividade/CNAE;
- nao substituir contador;
- nao bloquear por incerteza generica;
- apontar campo concreto quando houver conflito.

Logs recomendados:
- modelo usado;
- tentativa;
- falha/sucesso;
- tokens de entrada;
- tokens de saida;
- tokens totais.

## Contrato Minimo do Payload de Emissao
Ao portar, garanta que os payloads consigam representar:

- `organization_id`
- `cliente`
- `itens`
- `valor_total`
- `valor_frete`
- `valor_seguro`
- `valor_desconto`
- `valor_outras_despesas`
- `meio_pagamento`
- `environment`
- `tipo_documento`
- `natureza_operacao`
- `tipo_nfe`
- `finalidade_nfe`
- `ind_pres`
- `ind_intermed`
- `ind_final`
- `intermediador`
- `transporte`
- `entrega`
- `retirada`
- `inf_ad_fisco`
- `observacao`
- `referenced_key`

Esse contrato nao precisa ser identico no banco, mas precisa existir na fronteira entre UI e emissao.

## Riscos da Estrategia de Copia Gradual

### Risco 1: Divergencia entre sistemas
Um bug corrigido na autoeletrica pode ficar esquecido no apoio-contabil ou nas oticas.

Mitigacao:
- manter este documento atualizado;
- criar checklist de portabilidade;
- registrar versao/data da copia em cada sistema;
- manter lista de correcoes fiscais aplicadas.

### Risco 2: Copiar regra especifica da autoeletrica para sistema onde nao se aplica
Exemplo:
- CSOSN padrao;
- observacao de remessa;
- CFOP de garantia/conserto;
- comportamento de venda.

Mitigacao:
- revisar cada template no apoio-contabil com o contador;
- separar no codigo o que e regra geral do que e regra de negocio do sistema;
- documentar divergencias por sistema.

### Risco 3: Esquecer migrations ou variaveis de ambiente
Mitigacao:
- manter checklist tecnico de portabilidade;
- nunca copiar apenas arquivos de UI;
- sempre copiar migrations, actions, rotas, variaveis e ajustes de banco relacionados.

### Risco 4: Testar pouco em homologacao
Mitigacao:
- repetir checklist completo por sistema;
- nao assumir que passou na autoeletrica, logo passara na otica;
- cada sistema precisa homologar com seus proprios produtos, empresas e cenarios.

## Checklist de Portabilidade Para Cada Sistema

### Antes de Copiar
- [ ] Autoeletrica esta estavel no fluxo que sera copiado.
- [ ] Migrations usadas estao identificadas.
- [ ] Variaveis `.env` necessarias estao listadas.
- [ ] Campos obrigatorios do cadastro da empresa estao documentados.
- [ ] Checklist de homologacao esta atualizado.
- [ ] PDFs/XMLs de teste locais nao serao copiados.

### Arquivos/Camadas a Avaliar
- [ ] Actions de emissao fiscal.
- [ ] Actions de banco fiscal.
- [ ] Actions de auditoria por IA.
- [ ] Tela completa `/fiscal/nfe`.
- [ ] Contrato entre UI e emissao preserva `indPres`, `indIntermed`, `indFinal`, pagamento, intermediador, frete, seguro, desconto, outras despesas e referencia de origem.
- [ ] Busca e clonagem de NF-e para pre-preencher a UI sem reaproveitar autorizacao.
- [ ] Cards de clonagem exibem resumo fiscal (CFOP, origem/CSOSN/CST, IPI, PIS, COFINS) para escolha rapida da nota base.
- [ ] Troca de operacao/finalidade apos clonagem reaplica template fiscal e nao carrega observacao incoerente.
- [ ] Nota de origem opcional em `Outra operacao` envia `NFref` quando selecionada.
- [ ] Tela fiscal/listagem de notas.
- [ ] Rota de impressao/download.
- [ ] Configuracoes da empresa.
- [ ] Fechamento/inutilizacao.
- [ ] Helpers de XML/PDF.
- [ ] Migrations de sequencia, serie e tabelas relacionadas.

### Banco de Dados
- [ ] `company_settings.nfe_serie` existe.
- [ ] `company_settings.cnae` existe para NFS-e, mas nao e usado como bloqueio principal da auditoria de NF-e.
- [ ] `nfe_sequences` existe.
- [ ] RPC `get_next_nfe_number` existe.
- [ ] Tabelas fiscais possuem campos esperados.
- [ ] `fiscal_invoices` armazena XML/PDF/status corretamente.
- [ ] `fiscal_invoices.payload_json` preserva `infNFe`, `ide`, `det`, `transp`, `pag`, `infAdic` e `NFref` quando houver.
- [ ] Inutilizacoes suportam modelo `NFCe` e `NFe`.

### Variaveis e Credenciais
- [ ] Credenciais Nuvem Fiscal homologacao.
- [ ] Credenciais Nuvem Fiscal producao.
- [ ] Certificado digital/configuracao da empresa.
- [ ] Responsavel tecnico da software house configurado para NF-e/NFC-e (`NFE_RT_*` ou campos `rt_*`/`responsavel_tecnico_*`).
- [ ] Chaves de IA, se operacao assistida for usada.

### Testes Minimos de Homologacao
- [ ] Venda simples.
- [ ] Venda interna e interestadual.
- [ ] Validacao local de CPF/CNPJ (participante, transportadora e intermediador) bloqueando antes da Nuvem Fiscal.
- [ ] Clonar NF-e existente apenas como rascunho, sem reaproveitar numero, chave, protocolo, status ou autorizacao.
- [ ] Clonar venda e trocar para bonificacao/doacao: participante e itens permanecem, template fiscal e observacao sao recalculados.
- [ ] Clonar nota errada/rejeitada quando filtro permitir, corrigir dados e emitir novo rascunho sem reaproveitar identidade fiscal antiga.
- [ ] Venda com frete.
- [ ] `modFrete = 9` com valor de frete maior que zero bloqueia antes da emissao.
- [ ] Venda com desconto.
- [ ] Desconto maior que total dos itens bloqueia antes da emissao.
- [ ] Venda com IPI tributado.
- [ ] Venda de saida com `indPres = 0` bloqueia antes da auditoria por IA.
- [ ] Operacao com intermediador ativo exige CNPJ valido do intermediador.
- [ ] Remessa em garantia.
- [ ] Retorno de garantia.
- [ ] Remessa para conserto.
- [ ] Retorno de conserto.
- [ ] Devolucao baseada em nota de origem.
- [ ] Outra operacao com nota de origem opcional gera `NFref` quando a chave for valida.
- [ ] Outra operacao sem nota de origem continua permitida quando a operacao nao exigir referencia.
- [ ] Bonificacao/doacao.
- [ ] Transferencia, quando aplicavel.
- [ ] Transferencia entre filiais bloqueia quando raiz de CNPJ emitente/destinatario for diferente.
- [ ] Transferencia para/retorno de deposito com raiz diferente exibe alerta de conferencia contabil.
- [ ] UI sem regressao de status: quando finalidade estiver habilitada, nao pode aparecer "operacao bloqueada/desativada".
- [ ] Operacao assistida com auditoria por IA.
- [ ] Auditoria por IA sem botao dedicado: chamada automatica no momento de emissao da operacao assistida.
- [ ] Auditoria por IA recebe `company_fiscal_context` e `operacao_fiscal`.
- [ ] Auditoria por IA nao usa CNAE como motivo principal de bloqueio de NF-e.
- [ ] Auditoria por IA registra no terminal modelo, tentativa, falha/sucesso e tokens de entrada/saida.
- [ ] Templates com alteracoes tecnicas relevantes exibem aviso de confirmacao antes da emissao.
- [ ] Download de XML.
- [ ] XML autorizado sem `xml_content` fica laranja, tenta persistir automaticamente e vira azul quando salvo no banco.
- [ ] Clique no XML laranja baixa/persiste XML e atualiza a lista depois do download.
- [ ] Download de DANFE/PDF.
- [ ] Inutilizacao de NF-e em homologacao.
- [ ] XML de NF-e e NFC-e contem `infRespTec` da software house, nao da empresa emitente.

## Validacao Especifica no Apoio-Contabil
Como o apoio-contabil sera usado por um contador, ele deve servir como etapa de amadurecimento fiscal.

Pontos para o contador revisar:
- natureza da operacao de cada template;
- CFOP usado em operacao interna e interestadual;
- CSOSN/CST padrao;
- quando destacar ou nao ICMS;
- quando destacar ou nao IPI;
- uso correto de `IPINT` e `IPITrib`;
- uso correto de `cEnq`;
- PIS/COFINS padrao;
- observacoes fiscais obrigatorias;
- tratamento de remessa/retorno;
- tratamento de garantia/conserto;
- tratamento de bonificacao, brinde e doacao;
- regras para transferencia entre filiais/depositos;
- coerencia dos dados trazidos por clonagem antes de transformar o rascunho em nova emissao;
- limites da operacao assistida.

Perguntas importantes para o contador:
- Quais templates podem ir para producao sem revisao manual?
- Quais templates precisam sempre de conferencia contabil?
- Quais CFOPs devem ser bloqueados para certos cenarios?
- Quais operacoes exigem observacao fiscal obrigatoria?
- Quais campos devem ficar livres para orientacao contabil?
- Quais campos nunca devem ser editaveis pelo usuario comum?

## Registro de Versao Manual
Enquanto nao houver biblioteca/API central, cada sistema deve registrar a versao fiscal copiada.

Sugestao de controle simples:

```txt
Sistema: autoeletrica
Versao fiscal base: 2026-05-19
Status: homologacao/producao
Observacoes: primeira implementacao completa de NF-e.
```

```txt
Sistema: apoio-contabil
Versao fiscal base copiada de: autoeletrica 2026-05-19
Status: pendente de adaptacao
Validado por contador: nao/sim
Observacoes: primeiro sistema destino da portabilidade.
```

## Quando Reconsiderar Biblioteca ou API Central
Reavaliar depois que pelo menos dois ou tres sistemas estiverem usando a mesma base fiscal.

Sinais de que chegou a hora:
- mesma correcao precisou ser aplicada em varios sistemas;
- regras fiscais comecaram a divergir sem controle;
- manutencao manual ficou lenta;
- contador validou regras gerais reaproveitaveis;
- ficou claro qual contrato de dados todos os sistemas conseguem seguir.

Nesse momento, considerar:
- primeiro uma biblioteca compartilhada (`fiscal-core`);
- depois, se fizer sentido, uma API fiscal central.

## Decisao Atual
Seguir com copia gradual e controlada.

Ordem:
1. Autoeletrica.
2. Apoio-contabil.
3. Primeiro sistema de otica.
4. Segundo sistema de otica.
5. Emissores fiscais dedicados.

A prioridade agora e estabilizar a autoeletrica e usar o apoio-contabil como primeira validacao contabil mais profunda antes de espalhar para sistemas com usuarios menos tecnicos.
