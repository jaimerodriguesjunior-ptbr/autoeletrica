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
- [ ] Busca e clonagem de NF-e para pre-preencher a UI sem reaproveitar autorizacao.
- [ ] Cards de clonagem exibem resumo fiscal (CFOP, origem/CSOSN/CST, IPI, PIS, COFINS) para escolha rapida da nota base.
- [ ] Tela fiscal/listagem de notas.
- [ ] Rota de impressao/download.
- [ ] Configuracoes da empresa.
- [ ] Fechamento/inutilizacao.
- [ ] Helpers de XML/PDF.
- [ ] Migrations de sequencia, serie e tabelas relacionadas.

### Banco de Dados
- [ ] `company_settings.nfe_serie` existe.
- [ ] `nfe_sequences` existe.
- [ ] RPC `get_next_nfe_number` existe.
- [ ] Tabelas fiscais possuem campos esperados.
- [ ] `fiscal_invoices` armazena XML/PDF/status corretamente.
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
- [ ] Venda com frete.
- [ ] Venda com desconto.
- [ ] Venda com IPI tributado.
- [ ] Remessa em garantia.
- [ ] Retorno de garantia.
- [ ] Remessa para conserto.
- [ ] Retorno de conserto.
- [ ] Devolucao baseada em nota de origem.
- [ ] Bonificacao/doacao.
- [ ] Transferencia, quando aplicavel.
- [ ] Transferencia entre filiais bloqueia quando raiz de CNPJ emitente/destinatario for diferente.
- [ ] Transferencia para/retorno de deposito com raiz diferente exibe alerta de conferencia contabil.
- [ ] UI sem regressao de status: quando finalidade estiver habilitada, nao pode aparecer "operacao bloqueada/desativada".
- [ ] Operacao assistida com auditoria por IA.
- [ ] Auditoria por IA sem botao dedicado: chamada automatica no momento de emissao da operacao assistida.
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
