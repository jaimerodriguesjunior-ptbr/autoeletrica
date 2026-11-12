# Auditoria — plano de fluxo visual 2,5D e arquivamento de OS

**Data:** 09/11/2026.  
**Objeto:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.  
**Método:** leitura do plano, de `AGENTS.md`, de `CONTEXTO_NUVEM_LOCAL_FISCAL.md` e do código local. Nenhuma funcionalidade foi implementada, o plano original não foi editado e o banco remoto não foi consultado.

**Legenda usada abaixo.** Requisito é o que o pedido do usuário fixa. Proposta é o que o plano sugere e a seção 22 ainda deixa aberto. Fato é o que o código ou o esquema local mostram. Hipótese é uma conclusão que depende de dado não lido no banco.

## 1. Parecer inicial

**Painel de consulta: apto com condições.** As cinco filas, a cor pela idade da OS e o recorte de OS com veículo cabem nos dados e na interface atuais, sem engine 3D e sem o status `arquivado`. A consulta pode ser publicada sozinha. A condição de produto é que a fila “Aguardando peça” continua vazia enquanto nenhuma tela gravar `aguardando_peca`. A condição técnica é a consulta nova filtrar a organização no servidor, calcular contagens e busca sobre o conjunto inteiro e tratar a miniatura do dashboard como ilustração.

**Arquivamento e desarquivamento com efeito em estoque: requer revisão.** O plano descreve a transação, a idempotência e a recusa de usar `quantity` como prova. Esse núcleo está certo. Ele ainda não fica seguro para habilitar, por quatro bloqueios:

1. A revisão manual de legado transforma um número declarado em crédito de estoque. Não há, no esquema local, movimento que torne esse número um fato.
2. Os saldos continuam graváveis pelo cliente, com leitura e escrita de valor absoluto. Trocar só a função nova deixa as telas e as abas antigas sobrescreverem o delta.
3. A autorização proposta lê `profiles.cargo`. A política local de RLS permite ao usuário alterar a própria linha de perfil, e o repositório não mostra trava de coluna nem trigger. Sem confirmação no banco instalado, o cargo não segura a liberação de estoque.
4. A função privilegiada, se seguir o algoritmo da seção 11.4 como está, credita `product_id` sem provar que o produto pertence à mesma organização. A FK local não carrega a organização.

Mudar o status sem crédito de estoque também exige revisão antes de aceitar `arquivado`: exclusão, cancelamento e remoção devolvem `item.quantity` e reabrir a OS não confere o status atual. Um bloqueio do estoque não impede o painel. Um bloqueio do painel não seria motivo para adiar o desenho do estoque, mas o estoque não pode ser ligado junto com a tela.

Os 69 registros abertos da NHT continuam sendo informação do usuário. Esta auditoria não os contou e não os distribuiu por status, veículo ou baixa.

## 2. Achados por prioridade

### P1-01 — A reconciliação de legado credita uma declaração

- **Natureza:** risco introduzido pelo plano.
- **Bloco:** legado e estoque.
- **Plano:** seção 11.5, passos que gravam a quantidade “ainda debitada” e usam esse resultado na mesma transação do arquivamento. Seções 11.1 e 11.2, que reconhecem a ausência de prova.
- **Código:** não existe tabela de movimento em `schema.json` nem no código pesquisado (`stock_movement`, `product_stock_movements` e equivalentes: nenhuma ocorrência). `work_order_items.quantity` é a quantidade comercial (`schema.json`, definição de `work_order_items.quantity`, numérico). A baixa é um efeito colateral no cliente, sem coluna de débito.

**Cenário.** OS antiga em `orcamento`, com uma peça de `product_id` preenchido e `quantity = 2`. A peça pode ter sido incluída por `handleAdicionarItem(..., false)` em `app/(admin)/os/detalhes/[id]/page.tsx`, por volta da linha 1363, sem baixa, ou com quantidade alterada depois, nas linhas 3467–3469, também sem ajuste de saldo. O responsável informa “2” na revisão. O arquivamento grava crédito de 2. O saldo aumenta sem que o sistema tenha visto a baixa.

**Efeito.** Estoque criado a partir de testemunho. Repetir arquivar, desarquivar e arquivar reproduz o mesmo erro em ciclos diferentes; a chave de operação impede só a repetição da mesma chamada.

**Correção mínima.** Para item legado sem movimento contemporâneo, arquivar não credita. A declaração humana, se um dia existir, é um ajuste manual de estoque, com autor e motivo, fora da transação que muda o status, e sem copiar `quantity` para o campo. Itens novos só creditam `stock_debited_qty` gravado na mesma transação da baixa. Não preencher esse campo na migração.

**Confiança:** alta quanto ao código e ao texto do plano. Não foi comprovado quantos itens da NHT cairiam nesse caso.

### P1-02 — Travar a linha só na função nova não impede o saldo absoluto

- **Natureza:** defeito atual; o plano o reconhece na seção 11.1 e ainda deixa a contenção incompleta na seção 11.3.
- **Bloco:** estoque e arquivamento.
- **Plano:** seção 11.3 pede migrar os escritores. Não exige que o banco recuse `UPDATE` direto de `estoque_atual`.

Escritores de saldo encontrados, todos com leitura seguida de gravação do valor absoluto, salvo o cadastro que já grava o valor inicial:

| Caminho | Efeito |
| --- | --- |
| `app/(admin)/os/detalhes/[id]/page.tsx` `handleAdicionarItem`, cerca das linhas 1274–1286 | subtrai a quantidade incluída, hoje fixa em 1, só se `baixarEstoque` |
| O mesmo arquivo, `handleCadastrarEAdicionarPeca`, linha 1363 | chama a inclusão com `false`: há `product_id` e não há baixa |
| O mesmo arquivo, `handleAdicionarGlobal`, linha 1444, e o scanner de código de barras, linha 1537 | cria o produto com saldo 0 e baixa 1 em seguida |
| O mesmo arquivo, `handleRemoverItem`, linhas 759–770 | soma `item.quantity` se houver produto e a peça não for do cliente |
| O mesmo arquivo, `handleTogglePecaCliente`, linhas 805–818 | soma ou subtrai a quantidade atual |
| O mesmo arquivo, `handleCancelarOS`, linhas 881–893, e `handleExcluirOS`, linhas 936–949 | devolvem `item.quantity` |
| O mesmo arquivo, modal de editar item, linhas 3467–3469 | altera `quantity` e o total, sem saldo |
| `app/(admin)/recibo/[id]/page.tsx`, linhas 114–126 | cancelar venda soma `item.quantity` |
| `app/(admin)/atendimento/nova-venda/page.tsx`, linhas 387–399 | subtrai `item.qtd`; o aviso de estoque zero não impede a gravação |
| `app/(admin)/estoque/[id]/page.tsx`, linhas 144–160 | grava o saldo digitado |
| `app/(admin)/estoque/importar/page.tsx`, linhas 534–537 | grava saldo lido antes mais `qCom` |
| `app/(admin)/estoque/novo/page.tsx`, linhas 193–221 | cria o saldo inicial e, no item pendente, só preenche `product_id`; não baixa |

`app/(admin)/atendimento/venda-direta/page.tsx` cria serviço de bancada sem produto. `src/actions/fiscal_db.ts` atualiza NCM, não saldo. Não há RPC de estoque no código lido.

**Cenário.** A função de arquivar soma 2 com `estoque_atual = estoque_atual + 2` e segura a linha. Uma venda que leu 10 antes grava 9 depois. O crédito some. O mesmo ocorre com a tela de estoque, a importação e uma aba aberta na OS.

**Efeito.** Perda de entrada, de venda ou da própria devolução do arquivamento. O service worker em `public/sw.js` não repete POST; ele não é a via do problema. A via é o cliente Supabase, que a política `tenant_update_products` em `migration_rls_multi_tenant.sql` autoriza dentro da organização.

**Correção mínima.** Uma função única aplica o delta. Um trigger recusa mudança de `estoque_atual` quando a função não marcou a transação com um indicador inacessível ao PostgREST. Vale para o papel autenticado e para o cliente administrativo. Migrar os arquivos sem essa recusa não libera o arquivamento.

**Confiança:** alta no código local. Grants efetivos do papel `authenticated` não foram lidos no banco.

### P1-03 — O cargo usado como permissão pode ser escrito pelo próprio usuário

- **Natureza:** defeito atual que impede a habilitação segura do arquivamento.
- **Bloco:** arquivamento e legado.
- **Plano:** seções 13 e D04. A proposta limita arquivar, desarquivar e reconciliar a `owner`, `admin` e `gerente`.
- **Código:** `migration_rls_multi_tenant.sql`, linhas 120–121, política `profiles_update_own` para `UPDATE` quando `id = auth.uid()`, sem restrição de coluna. `schema.json`, `profiles.cargo`, texto com padrão `employee`. Nenhum trigger de `profiles` aparece nas migrações locais. `src/actions/os.ts`, linhas 20–23, confia no cargo lido do perfil. `src/contexts/AuthContext.tsx`, linhas 61–66, desliga usuário inativo só no navegador.

**Cenário.** Um funcionário grava `cargo = 'owner'` na própria linha e chama a função de arquivar. A função vê o cargo elevado e credita estoque. O botão escondido não participa dessa sequência.

**Efeito.** Liberação de estoque e reativação de OS por quem o produto quer manter fora da ação.

**Correção mínima.** Antes de habilitar a mutação, o banco precisa recusar a alteração de `cargo` e de `organization_id` pelo próprio usuário, ou a função precisa de uma autorização que não dependa de uma coluna que o cliente grava. A checagem de `ativo` entra na função, no servidor. Confirmar no banco instalado se já existe `GRANT` de coluna ou trigger ausente do repositório. Se o `GRANT` permitir o `UPDATE`, este achado passa a ser P0.

**Confiança:** média-alta. A política local não protege a coluna. O privilégio efetivo no projeto Supabase não foi consultado.

### P1-04 — O crédito por `product_id` não prova a organização do produto

- **Natureza:** risco introduzido pelo plano.
- **Bloco:** estoque e arquivamento.
- **Plano:** seção 11.4, passo 6, agrupa e bloqueia produtos sem comparar a organização. A seção 14 pede para conferir a FK; o algoritmo ainda não usa o resultado dessa conferência.
- **Código:** `schema.json`, `work_order_items.product_id` referencia `products.id`. `products.organization_id` é outra FK, para `organizations`. Não há FK composta. `migration_rls_multi_tenant.sql`, linhas 147–155, aceita o item quando o `organization_id` do item é o da sessão. Não exige que o produto seja da mesma organização. `migration_global_products.sql` e o campo `global_product_id` usado em `handleAdicionarGlobal` ligam um catálogo compartilhado; o saldo visto no código fica na linha de `products` da organização.

**Cenário.** Um item da organização A guarda o UUID de um produto da organização B. A tela normal não consegue alterar esse produto por causa do RLS. A função com cliente administrativo, ou `SECURITY DEFINER`, atualiza o saldo de B ao arquivar A.

**Efeito.** Estoque de outra oficina alterado. Não foi verificado se já existe linha cruzada.

**Correção mínima.** Na mesma transação, antes de qualquer delta, exigir `products.organization_id = work_orders.organization_id`. Divergência aborta o arquivamento desse item, sem crédito e sem criar produto. O painel de leitura não precisa dessa função.

**Confiança:** alta na lacuna do algoritmo e no formato da FK. Existência de linhas cruzadas: não verificável aqui.

### P2-01 — A quinta fila não tem, no código atual, quem a preencha

- **Natureza:** decisão de produto em aberto, com efeito na experiência pedida.
- **Bloco:** painel de consulta.
- **Plano:** seção 5 trata `aguardando_peca` como estágio existente. Seção 7.3 mantém aprovar, iniciar, entregar e editar nas telas atuais.
- **Código:** a busca por `aguardando_peca` encontra filtros e rótulos em `ServiceOrderList.tsx`, `dashboard/page.tsx`, `os/page.tsx` e `PortalClient.tsx`. A gravação de status na OS, em `handleStatusChange`, usa `aprovado`, `em_servico` e `pronto`. O checkout grava `entregue`. O portal grava `aprovado`. A criação grava `orcamento`. A bancada nasce `aprovado` em `venda-direta/page.tsx`, linhas 130–137. Nenhum arquivo pesquisado grava `aguardando_peca`.

**Cenário.** O painel renderiza a fila “Aguardando peça”. Todas as OS com veículo seguem orçamento, aprovado, em serviço ou pronto. A fila fica vazia de forma estável. O carro que está com o cliente por falta de peça não aparece nesse estágio, porque o sistema não oferece o estágio.

**Efeito.** A quinta fila exigida pelo usuário existe como filtro e não como fluxo. Isso não corrompe dados e não bloqueia as outras quatro.

**Correção mínima.** Registrar na seção 22 uma decisão explícita: incluir na tela de OS já existente um comando que grave `aguardando_peca`, ou aceitar a fila vazia até essa transição entrar em outro trabalho. Não inventar carros nessa fila.

**Confiança:** alta no código lido. Um cliente antigo ou um SQL manual podem ter gravado o status; a contagem disso está no banco.

### P2-02 — Vários escritores de status e de vínculo não entram no mesmo controle

- **Natureza:** risco introduzido se a implementação seguir só a lista explícita.
- **Bloco:** arquivamento.
- **Plano:** seções 12, 13 e 16 pedem trava no banco e o mesmo controle da OS para vínculo e aprovação. A matriz não nomeia os caminhos abaixo.

Fatos:

- `src/actions/os.ts`, `reopenOS`, linhas 44–93, não lê o status atual. Apaga comissões pendentes e grava `pronto` com cliente administrativo. A tela só mostra a reabertura para OS entregue; a função aceita o id que receber.
- `app/api/portal/aprovar/route.ts`, linhas 16–41, lê `orcamento` e atualiza por `id`, sem repetir o status na escrita. Usa cliente administrativo, que não passa pelo RLS.
- Adiantamento em `os/detalhes/[id]/page.tsx`, por volta das linhas 1176–1217, insere `transactions` com a OS ainda aberta, inclusive em orçamento. O botão aparece para todo status que não seja `cancelado` nem `entregue`, linhas 2423–2431.
- `handleSalvarAgendamento`, linhas 1635–1654, insere `appointments` com `work_order_id` sem olhar o status. O botão “+ Reagendar”, linhas 1764–1770, também não olha.
- `handleExcluirOS` não recusa OS entregue, cancelada ou um futuro `arquivado`. O botão da linha 1787 está no cabeçalho, fora da condição dos itens.
- `src/actions/fiscal_emission.ts` grava `fiscal_invoices.work_order_id`. A busca no arquivo não achou conferência de status da OS. A lista e o cartão limitam a emissão a `pronto` e `entregue` (`fiscal_db.ts`, linha 56; `WorkOrderFiscalCard.tsx`, linha 60). A Nuvem Local Fiscal não precisa ser chamada para arquivar; o plano está certo ao não cancelar documento. O buraco é a inserção local do vínculo.
- `get_dashboard_metrics` em `rpc_get_dashboard_metrics.sql` é `SECURITY DEFINER` e recebe `p_organization_id` do chamador. É um precedente para não copiar. Pode ficar fora deste trabalho.

**Cenário.** Duas sessões: uma arquiva e outra, no meio da prévia, lança adiantamento, aprova pelo token ou chama `reopenOS`. Sem uma linha `FOR UPDATE` compartilhada, o vínculo nasce depois da verificação, ou o status sai de `arquivado` sem repor o débito. Em seguida, a exclusão antiga soma `quantity` de novo.

**Efeito.** OS arquivada aprovada, reaberta em `pronto`, com estoque creditado e possivelmente creditado outra vez. Ou orçamento arquivado com recebimento nascido depois da checagem.

**Correção mínima.** Enumerar, na seção 16, `reopenOS`, `handleStatusChange`, cancelamento, exclusão, adiantamento, checkout, portal de aprovação, emissão e criação de agendamento. Cada um toma a mesma trava da OS ou o trigger recusa a escrita quando o status é `arquivado` ou quando a transição entra e sai desse status fora da função. A aprovação do portal precisa de `UPDATE ... WHERE status = 'orcamento'` dentro dessa trava. Não usar um booleano enviado pelo navegador para desligar o trigger.

**Confiança:** alta nos caminhos lidos.

### P2-03 — Não há coluna de versão para a prévia, e `updated_at` não serve

- **Natureza:** risco introduzido pelo plano.
- **Bloco:** arquivamento.
- **Plano:** seções 10.1 e 11.4 exigem versão da prévia e dos itens.
- **Código:** `work_orders.updated_at` existe no `schema.json` com padrão `now()`. As migrações locais não criam trigger de `work_orders` que o atualize. As gravações lidas mudam `status`, `total`, `description` e itens sem enviar `updated_at`. O dashboard usa esse campo como se marcasse o mês da conclusão (`dashboard/page.tsx`, linhas 87–90, e `rpc_get_dashboard_metrics.sql`, linhas 92–93).

**Cenário.** A prévia lê a OS. Outra pessoa altera a quantidade do item. `updated_at` permanece o da criação. A confirmação aceita a prévia e devolve o débito antigo, ou recusa uma prévia válida, conforme o campo escolhido na pressa.

**Efeito.** Conflito falso ou liberação com itens diferentes dos exibidos.

**Correção mínima.** Versão monotônica da OS e dos itens, incrementada na função que altera status, itens ou débito. A prévia devolve essa versão. A confirmação exige igualdade. Não usar `updated_at` nem um hash só no navegador.

**Confiança:** alta no repositório. Um trigger remoto não versionado derrubaria a premissa sobre `updated_at`.

### P2-04 — Busca e totais precisam nascer no servidor, junto com a paginação

- **Natureza:** risco introduzido se a paginação da seção 8 for aplicada no cliente.
- **Bloco:** painel de consulta.
- **Plano:** seção 7.2 pede busca e totais do resultado filtrado. Seção 8 devolve 20 OS por fila e contagens exatas. Não diz que o termo de busca entra na consulta antes do corte.
- **Código atual de contraste:** `ServiceOrderList.tsx`, linhas 78–91, traz todas as OS com veículo e filtra no navegador. Esse atalho deixa de valer com página de 20.

**Cenário.** A fila tem 60 orçamentos. A primeira página não contém a placa procurada. A busca local responde vazio e o contador mostra 20.

**Efeito.** OS existente some do fluxo visual. O usuário pode tratar o vazio como ausência de serviço.

**Correção mínima.** A busca por número, placa, modelo textual e cliente é parâmetro da consulta. As contagens usam o mesmo predicado da página. O cursor não corta o universo antes do filtro.

**Confiança:** alta como condição de implementação. O plano quase chega lá; falta a frase que impede o atalho.

### P2-05 — “Agendamento ativo” e a configuração em `company_settings` estão frouxos

- **Natureza:** decisão de produto mais uma lacuna de permissão.
- **Bloco:** arquivamento e implantação.
- **Plano:** D01, D10 e a tabela da seção 14, que cogita guardar X em `company_settings`.
- **Código:** `migration_appointments.sql` cria os status iniciais. `migration_add_confirmado_status.sql` acrescenta `confirmado`. `migration_add_type_ja_tem_os.sql` acrescenta `ja_tem_os`. A política de `company_settings` em `migration_rls_multi_tenant.sql`, linhas 207–213, permite `UPDATE` a quem está na organização, sem cargo. Não há coluna de fuso em `schema_types.txt`.

**Cenário.** O bloqueio só trata `agendado` e ignora `confirmado`: a OS arquiva com retorno marcado. Ou um funcionário altera X porque a coluna ficou em `company_settings` e o RLS não olha o cargo.

**Efeito.** Compromisso some da decisão humana, ou a regra de prazo muda sem o responsável.

**Correção mínima.** Definir ativo como `agendado`, `confirmado` e `em_atendimento`. `concluido`, `cancelado` e `nao_compareceu` não bloqueiam. Não cancelar a linha. Guardar X, a cadência e a política de cor numa escrita que só o grupo autorizado atravesse. Fixar a apresentação em `America/Sao_Paulo` enquanto não existir fuso por organização. O relógio da idade continua sendo o do servidor, em intervalos completos de 24 horas, como a seção 6.1 já propõe.

**Confiança:** alta no texto local das migrações. O conjunto instalado de status pode ter divergido; confirmar na constraint real antes de codar o predicado.

### P3-01 — O total do painel não deve ganhar uma permissão que a lista não tem

- **Natureza:** decisão de produto.
- **Bloco:** painel de consulta.
- **Plano:** seção 7.3 condiciona o total financeiro a “a permissão correspondente”.
- **Código:** `ServiceOrderList.tsx`, linha 394, mostra `os.total` a quem vê a lista. `dashboard/page.tsx`, linhas 15 e 151, esconde o faturamento quando o cargo não é exatamente `owner`. O detalhe da OS mostra o total dos itens sem essa trava. Não há RLS por valor.

**Efeito.** Esconder o total só no painel cria uma regra nova, ainda não pedida. Mostrar o faturamento do dashboard a gerente e admin também seria regra nova.

**Correção mínima.** No painel, seguir a lista de OS: o total da ordem pode aparecer para quem já a abre. Não reutilizar a trava de faturamento do dashboard.

**Confiança:** alta.

### P3-02 — A faixa de 8 a 16 dias subestima o entorno já espalhado

- **Natureza:** limitação da estimativa, não defeito de comportamento.
- **Bloco:** implantação.
- **Plano:** seção 23.
- **Código:** a mutação de estoque e de status está espalhada no cliente, com dezenas de condições `status !== 'cancelado' && status !== 'entregue'` só no detalhe da OS. O arquivo de detalhe passa de 3.500 linhas.

**Efeito.** Tratar 3 a 6 dias como suficientes para “os escritores” empurra a equipe a migrar a tela e deixar recibo, importação, venda e `reopenOS` de fora. É o cenário do P1-02.

**Correção mínima.** Manter a frase de que a faixa não é cronograma. Separar, na estimativa, o painel somente leitura do conjunto trigger, escritores e prova de concorrência. A segunda parte só termina quando a lista de escritores desta auditoria estiver coberta.

**Confiança:** alta como leitura de escopo. Não é medição de velocidade de alguém.

## 3. Mapa de cobertura

### O que foi confrontado

| Área | Resultado da leitura | Onde |
| --- | --- | --- |
| Produto visual | Cinco status textuais existem no vocabulário da lista. Cor por idade e carro genérico não conflitam com o código. Não há Three.js em `package.json`. | `ServiceOrderList.tsx`; `package.json` |
| OS fora da oficina | Nenhum campo de box ou vaga entra na regra de lista. `aguardando_peca` é rótulo, não presença física. | seção 5 do plano; lista e dashboard |
| Dois relógios | `created_at` é `timestamptz` e serve à idade visual. Não há instante de entrada no status. | `schema.json`, `work_orders` |
| Bancada e venda | Venda de balcão nasce sem veículo e `entregue`. Bancada nasce sem veículo e `aprovado`. A API `app/api/os/create/route.ts` exige veículo e grava `orcamento`. | `nova-venda/page.tsx`, `venda-direta/page.tsx`, `migration_add_wo_tipo.sql` |
| Várias OS na mesma placa | A lista não deduplica por placa. O scanner abre direto só quando há uma OS aberta. | `ServiceOrderList.tsx`, linhas 203–214 |
| Status desconhecido | Texto livre, sem check local de `work_orders.status`. `em_andamento` e `finalizado` aparecem em SQL antigo e no fechamento. | `schema.json`; `migration_add_wo_tipo.sql`; `rpc_get_dashboard_metrics.sql` |
| Prévia estática | O plano separa desenho e contador, com estado de erro diferente de zero. Isso atende o risco de contagem falsa, desde que o texto “Prévia ilustrativa” exista de fato. | seção 4.2 |
| Seleção e celular | HTML, CSS, uma imagem por faixa e desfoque no contêiner são compatíveis com o stack. Não há medição em aparelho. | seções 7 e 18 |
| Estoque legado | Não há ledger. `quantity`, `product_id` e `catalog_status` não provam débito. | seções 11 do plano e escritores da P1-02 |
| Quantidade fracionada e saldo negativo | Colunas numéricas. O editor aceita passo 0,01. Há caminhos que gravam saldo negativo. Não há `CHECK` de não negativo no recorte local. | `schema.json`; modal de item; cadastro por código de barras |
| Produto inativo ou excluído | O recorte de `products` não tem coluna `ativo`. A FK de item não declara `ON DELETE`. O padrão do Postgres impediria apagar produto ainda referenciado, se essa for a FK instalada. | `schema.json` |
| Portal e extrato | Token lê e aprova. Não há rota de arquivar por token. O extrato soma `total` de toda OS que não está `cancelado`. | `app/api/portal/aprovar/route.ts`; `extrato/route.ts`, linhas 66–74 |
| Financeiro no orçamento | Adiantamento cria transação antes da entrega. `payment_intent` é outro campo, gravado na aprovação, e não é transação. | detalhe da OS; `migration_add_payment_intent.sql` |
| Fiscal | Emissão de tela exige pronta ou entregue. Arquivar não deve chamar a Nuvem Local Fiscal nem cancelar documento. O contexto obrigatório foi lido. | `CONTEXTO_NUVEM_LOCAL_FISCAL.md`; `WorkOrderFiscalCard.tsx` |
| Reabertura | Destino `pronto`, com PIN e comissões. É outra operação. O plano acerta em não reutilizá-la como desarquivar. | `src/actions/os.ts` |
| Agenda do dashboard | A lista de atraso exclui só `entregue` e `cancelado` e usa `previsao_entrega`. É outra coisa que a tabela `appointments`. | `dashboard/page.tsx`, linhas 122–135 |
| Histórico do cliente | O saldo em `clientes/[id]/page.tsx` sai de `transactions`, não do status. Arquivar não estorna essas linhas se o plano for seguido. | linhas 144–167 |
| Impressão | `app/imprimir/os/[id]/page.tsx` imprime a OS encontrada, sem rótulo de arquivada. | cabeçalho da página |
| Migrações | Arquivos SQL na raiz, comentário de execução manual. `supabase/migrations` está vazio. `schema.json` e `schema_types.txt` não trazem `tipo`, `employee_id`, `payment_intent` nem `catalog_status`, que o código e outras migrações já usam. | raiz do repositório |
| Service worker | Rede primeiro, e só para GET. Não é fila offline de estoque. | `public/sw.js` |
| Cargos no código | `owner`, `admin` e `gerente` formam o grupo de `reopenOS` e de `isAdmin`. Várias mensagens chamam o `owner` de gerente. `employee` é o padrão do esquema. | `AuthContext.tsx`; `os.ts`; `schema.json` |

### Limitações

- Não houve leitura do banco remoto: enum ou check de status, triggers, grants, RLS efetivo, índices, contagens, idades, vínculos, saldos negativos e linhas com organização cruzada continuam não comprovados.
- `schema.json` é fotografia antiga. Onde o código e uma migração posterior discordam dela, o relatório segue o código e a migração, e marca a dúvida.
- Não foi executado teste de concorrência. Os cenários de corrida são leitura estática dos escritores.
- Não foi medido o peso das imagens nem o blur em celular ou tablet.
- A contagem de 69 OS abertas da NHT não é fato desta auditoria.

### Onde não apareceu falha, no material lido

- O plano mantém cinco filas, cor por tempo e OS que pode estar fora da oficina. Isso acompanha o requisito.
- Carros iguais e genéricos, sem fabricante na ilustração, são compatíveis com o stack.
- A separação entre idade desde `created_at` e prazo contínuo em orçamento está clara. O primeiro relógio é implementável hoje. O segundo precisa de coluna nova.
- Desarquivar para `orcamento` é semanticamente diferente de `reopenOS`, que vai para `pronto` e mexe em comissão.
- Não há ledger escondido no código para reaproveitar. Criar movimento daqui em diante é proposta nova, não duplicação de uma tabela já achada.
- A miniatura ilustrativa, do jeito escrito na seção 4.2, não precisa mentir a contagem.
- A Nuvem Local Fiscal permanece intocada se a implementação não enviar cancelamento nem trocar provedor. O plano diz isso.
- Idempotência por chave mais recusa quando o status já não é `orcamento` cobre repetição e duas pessoas, desde que as duas regras existam juntas. A chave sozinha não cobre quem gera outra chave depois do sucesso; o status cobre.

Ausência desses itens no código não prova que o banco remoto seja igual ao repositório.

## 4. Decisões D01–D16

| ID | Caminho recomendado | Tipo | O que continua aberto |
| --- | --- | --- | --- |
| D01 | Não gravar 30 como regra implícita. O painel não depende de X. O backend de arquivar recusa a ação enquanto a organização não tiver um X escolhido. | Negócio. O dado para escolher X está no banco e não foi lido. | O número de dias e se cada oficina terá o seu. |
| D02 | Intervalo de 3 dias por usuário autorizado, persistido no servidor, combina com uso regular e não promete aviso com o sistema fechado. Quem abre o sistema só duas vezes na semana, com intervalo maior que 3 dias, pode ver o aviso uma vez. Se a meta for duas exibições em toda semana de uso, dois dias fixos da semana são mais estáveis. | Negócio, com limite técnico já honesto na seção 9.2. | Qual das duas cadências a oficina prefere. |
| D03 | Adotar as faixas da seção 6.1 como política inicial: menos de 3 dias, 3 a menos de 7, 7 a menos de 14, 14 ou mais, mais uma cor neutra para data ausente, inválida ou futura. Texto de idade sempre visível. Limites no relógio do servidor, em blocos de 24 horas. Exibição em `America/Sao_Paulo`. | Negócio para as cores; técnico para o relógio. | A oficina pode mudar as cores antes da publicação visual. Não bloqueia o desenho da consulta. |
| D04 | Usar o mesmo grupo que já reabre OS: `owner`, `admin` e `gerente`, normalizados em minúsculas. Funcionário consulta. Isso só vale depois do P1-03. A palavra “gerente” nas mensagens de WhatsApp e cobrança designa o `owner`; não misturar os dois. | Negócio, apoiado no código de reabertura. | Confirmação de que esse grupo é quem decide orçamento na oficina. A habilitação espera a trava de `cargo`. |
| D05 | Para OS que ainda estão em `orcamento`, usar `created_at` como estimativa rotulada. Não escrever isso como evento histórico. Os caminhos de tela encontrados só avançam a partir de orçamento; ainda assim, um `UPDATE` direto antigo não deixou rastro. A alternativa de começar a contar na implantação adia todos os orçamentos velhos e foge do pedido. | Técnico, com ressalva de dado não auditado. | Se a leitura futura do banco mostrar retorno frequente a `orcamento`, a estimativa precisa ser reapresentada à oficina antes de ligar o lembrete. |
| D06 | Não creditar legado. Arquivar legado, quando for habilitado, muda status e não saldo. Ajuste físico de prateleira fica no fluxo comum de estoque, com autor e motivo, sem herdar `quantity`. | Técnico. Vira negócio só se a oficina quiser, mesmo assim, digitar um crédito. Essa opção reabre o P1-01. | Quem faria um ajuste manual separado, se a oficina quiser inventário. Não é requisito do arquivamento. |
| D07 | A lista de escritores desta auditoria é o conjunto mínimo. O mecanismo comum é delta na função única mais trigger que recusa escrita direta de `estoque_atual`. Sem os dois, a liberação automática permanece desligada. | Técnico. | Grants e triggers já instalados. |
| D08 | Bloquear o desarquivamento inteiro quando faltar saldo para repor exatamente o que o último ciclo liberou. Não repor metade e não gravar negativo nesse caminho. O restante do sistema hoje permite negativo; esta operação nova não precisa copiar isso. | Negócio alinhado ao risco técnico. Pode ser fechado como condição de segurança. | Nenhum dado numérico. A decisão recomendada já permite implementar a regra. |
| D09 | Impedir arquivamento quando existir transação `paid` ou `pending`, comissão, ou nota em `draft`, `processing` ou `authorized`, em qualquer ambiente. Não tratar `payment_intent` como vínculo. Nota cancelada não bloqueia e não é apagada. Não estornar, não cancelar na Nuvem Local Fiscal e não zerar total. O bloqueio é proporcional porque o adiantamento já cria transação em orçamento. | Técnico até a oficina aceitar arquivar um orçamento que tenha sinal pago. | Essa exceção, se desejada, precisa de regra escrita. Estado desconhecido continua bloqueando. |
| D10 | Avisar e impedir enquanto houver agendamento `agendado`, `confirmado` ou `em_atendimento` ligado à OS. A pessoa resolve na agenda. O sistema não cancela. Compromisso concluído ou cancelado não impede. A lista de atraso do dashboard, baseada em `previsao_entrega`, exclui `arquivado` de qualquer forma: isso é correção técnica, não esta decisão. | Negócio para o impedimento; técnico para não apagar a agenda e para a lista de atraso. | A oficina pode preferir só avisar. Enquanto não preferir, o impedimento é a proposta segura. |
| D11 | Manter o primeiro arquivamento nas OS com veículo e status `orcamento`. Bancada nasce `aprovado` e venda nasce `entregue`; as duas ficam de fora do lembrete sem desenho extra. Não criar carro para registro sem veículo. | Negócio, compatível com o recorte visual. | Incluir orçamento antigo sem veículo fica para depois, na mesma ação de status, ainda sem carro. |
| D12 | Manter “Fluxo visual”. | Negócio já alinhado ao requisito. Pode ser fechado. | Nenhum. |
| D13 | Mais antigas primeiro, desempate por id, página inicial de 20, busca no servidor sobre o conjunto filtrado. | Técnico. | Ajustar 20 depois de medir o payload. Não bloqueia o desenho. |
| D14 | Conservar o momento atual da baixa: a inclusão pede baixa, com a exceção já existente do cadastro que chama `baixarEstoque = false`. Não transformar esta entrega em “reservar só depois da aprovação”. | Negócio. Mudar o momento seria outro projeto. | Nenhum para este plano, depois que a oficina confirmar que o comportamento atual permanece. |
| D15 | Miniatura estática, rótulo de ilustração e contador separado com a mesma regra do painel. | Negócio já compatível com o requisito. Pode ser fechado. | Nenhum, além de produzir a imagem. |
| D16 | Bloquear exclusão permanente de arquivada e impedir que cancelamento, exclusão e remoção de item devolvam `quantity`. É requisito técnico por causa do código atual, não um refinamento. | Técnico. | Nenhum para liberar o status. |

Enquanto D04, D06, D07, D08 e D09 não estiverem fechados no texto do plano, o arquivamento com estoque não começa. D01 e D02 impedem ligar o lembrete, não o painel. D03, D12, D13 e D15 podem ser fechados com as recomendações acima sem nova descoberta de código. D11 e D14 precisam de um sim da oficina e não mudam o desenho da consulta.

## 5. Escopo mínimo seguro

O plano está grande porque a liberação de estoque encosta em todos os escritores absolutos. A tela 2,5D, sozinha, não pede esse tamanho. O que amplia além do necessário é a revisão manual que credita legado, um segundo sistema de eventos se um único histórico imutável bastar, e configuração fina de cor por organização na primeira publicação.

**Indispensável para o painel.** Consulta única no servidor, organização da sessão, cinco filas dos status atuais, OS com veículo, uma OS por carro, cor pela idade desde `created_at`, seleção com foco, celular com rolagem por fila, card ilustrado com contador de verdade, entrada no dashboard e no atendimento para a mesma rota. Status desconhecido fica na lista, fora das filas.

**Indispensável para ligar o status com estoque, mais tarde.** Coluna de débito só para operações novas; função única de delta; trigger contra escrita direta; trava de transição de `arquivado`; versão da prévia; idempotência; recusa de legado sem crédito; bloqueios D08, D09 e D10; D16 no banco; autorização que não dependa de cargo gravável pelo cliente; produto da mesma organização.

**Pode ficar fora.** Corrigir saldos históricos. Inventariar a NHT dentro da implementação. Trocar o momento comercial da baixa. Arquivar bancada. Arquivamento em lote. Realtime. Engine 3D. Cancelar nota, estornar adiantamento ou apagar agendamento. Reescrever `get_dashboard_metrics`. O fato de essa função confiar no `organization_id` recebido é problema anterior e não entra neste escopo, desde que a consulta nova não a copie. A reabertura de OS entregue continuar sem conferir o status é problema anterior; passa a ser deste escopo apenas na hora em que `arquivado` existir, porque a função conseguiria tirá-lo de lá.

## 6. Plano de correção do documento

Não editei o plano original. As mudanças abaixo são para uma revisão posterior.

- **Seção 3.** Acrescentar os escritores que faltam: edição de quantidade, cadastro global e código de barras, venda de balcão, recibo, ajuste manual, importação, `reopenOS`, adiantamento, agendamento e emissão sem checagem de status no servidor. Dizer que `aguardando_peca` é lido e não é gravado pelas telas atuais.
- **Seção 5.** Dizer que a fila de peça só enche se a decisão nova criar a transição, ou que ela pode permanecer vazia.
- **Seção 6.** Fixar que `updated_at` não é relógio de status nem versão. `created_at` de orçamento antigo é estimativa rotulada, não evento.
- **Seção 7.3.** Trocar “permissão correspondente” pela regra da lista: quem abre a OS vê o total dela.
- **Seção 8.** Uma frase: busca e contagem usam o mesmo filtro, no servidor, antes da página de 20.
- **Seção 11.3.** Completar a lista de escritores com esta auditoria. Exigir o trigger de `estoque_atual`, não só a troca dos arquivos.
- **Seção 11.4.** Incluir a igualdade de organização do produto e a versão monotônica. Repetir que a chave de operação não substitui o `WHERE status = 'orcamento'`.
- **Seção 11.5.** Retirar o crédito feito com número digitado na revisão. Legado arquiva sem movimento de estoque. Ajuste de prateleira fica fora dessa transação.
- **Seção 12.** Citar adiantamento como transação real em orçamento e `payment_intent` como não transação. Nomear a emissão fiscal que não confere status.
- **Seção 13.** Incluir a política `profiles_update_own` e a proibição de o cliente alterar `cargo`. Incluir `reopenOS` como caminho administrativo que hoje ignora o status.
- **Seção 14.** Não colocar a política de arquivamento em `company_settings` enquanto o RLS for de qualquer membro. Um histórico imutável basta se o ciclo de estoque estiver nele; a segunda tabela só se o contrato ficar confuso.
- **Seção 16.** Linhas para `reopenOS`, adiantamento, novo agendamento, exclusão pelo cabeçalho e emissão direta. Separar a agenda de `previsao_entrega` da tabela `appointments`.
- **Seção 19.** O painel é a fase que pode ser codada primeiro. A fase de estoque não habilita crédito legado.
- **Seção 20.** Trocar linhas que repetem a implementação por provas de concorrência listadas na seção 7 deste relatório. Manter os casos de produto que já estão bons: duas OS na mesma placa, OS sem veículo, cor estável ao mudar status, aplicativo fechado, portal sem aceite.
- **Seção 22.** Marcar as recomendações desta auditoria como recomendação, não como aprovação do usuário. Acrescentar a decisão da transição `aguardando_peca` ou declarar que ela fica fora.
- **Seção 23.** Separar o esforço do painel do esforço do trigger e dos escritores. Não apresentar 8 a 16 dias como capacidade da parte de estoque.

## 7. Critérios para liberar

### Painel de consulta

Pode começar quando o texto do plano tiver a busca no servidor, o significado da fila vazia de peças e o total alinhado à lista. Provas para publicar:

- Uma OS de cada status com veículo cai só na própria fila. `pronto` permanece. `cancelado`, `entregue` e, no futuro, `arquivado` ficam fora.
- Duas OS da mesma placa geram dois carros.
- OS sem veículo, bancada e venda não viram carro e continuam nas listas atuais.
- Contagem da fila com mais de 20 OS é a contagem do filtro, não a dos cartões desenhados. A busca acha uma OS que está fora da primeira página.
- Data ausente, inválida ou futura não produz idade negativa.
- Trocar status não zera a idade desde `created_at`.
- O card não mostra zero quando a contagem falha, e o texto diz que os carros desenhados são ilustração.
- A organização vem da sessão. Um `organization_id` na URL não amplia o resultado.
- Teclado abre e fecha a seleção, e a rolagem horizontal fica dentro da fila.

Não é prova: screenshot com meia dúzia de carros, nem suíte que só renderiza o componente com dados fixos.

### Arquivamento com estoque

Só habilitar depois de D04, D06, D07, D08 e D09 fechados no plano, com D06 na forma que não credita legado, e das provas abaixo em banco isolado:

- Item incluído com baixa credita, no arquivamento, exatamente o débito ainda aplicado.
- Item incluído com `baixarEstoque = false`, serviço e peça do cliente creditam zero.
- Editar a quantidade depois da inclusão não muda o crédito.
- Duas linhas do mesmo produto, e duas OS, somam os débitos sem perder uma venda ou uma entrada concorrente. O teste usa o escritor absoluto antigo e precisa falhar enquanto esse escritor existir; depois do trigger, o escritor absoluto é recusado.
- Saldo já negativo e quantidade 0,01 seguem o numérico, sem truncar.
- Produto de outra organização aborta sem crédito.
- Legado sem movimento muda o status, se essa fase existir, e o saldo do produto permanece igual.
- Duas sessões arquivam; há um crédito. Repetir a mesma chave não credita de novo. Chave nova depois do sucesso encontra status diferente de `orcamento` e não credita.
- Aprovar pelo token ao mesmo tempo: uma transição vence. Não existe OS `aprovado` com o crédito do arquivamento já aplicado.
- Adiantamento inserido durante a prévia impede o arquivamento ou espera a trava e é recusado.
- `reopenOS`, exclusão, cancelamento e `UPDATE` direto de status não tiram a OS de `arquivado` nem creditam outra vez.
- Usuário com cargo alterado na própria linha não arquiva, enquanto o P1-03 não estiver fechado no banco.
- Desarquivar sem saldo não muda status nem baixa parcial. Com saldo, reaplica só o liberado no último ciclo.
- Falha no último item desfaz status, movimento e saldo.
- Extrato deixa de somar a OS arquivada. A lista de atraso do dashboard também. O histórico e a impressão ainda a encontram, com rótulo.
- Nota existente permanece. A emissão nova contra OS arquivada é recusada no servidor.

### Sequência e reversão

1. Publicar leitura do painel sem aceitar o status novo.
2. Publicar colunas, trigger de saldo e trigger de status, ainda sem botão de arquivar. Cliente antigo que grave saldo ou `arquivado` recebe erro.
3. Ligar a baixa rastreada nas operações novas e observar registros novos antes de qualquer crédito.
4. Só então habilitar arquivar para o grupo autorizado, numa organização piloto, sem crédito de legado e sem lote.
5. Reversão desliga o botão e conserva os triggers. Não recalcular saldos, não devolver status em massa e não apagar movimento. Código que não entenda `arquivado` não pode voltar a produção enquanto existir linha nesse status.

## 8. Parecer final

**Painel de consulta: apto com condições.** As condições estão na seção 7 e não dependem de estoque nem do status novo. A fila de peça precisa da decisão P2-01 para cumprir o requisito por inteiro; as outras quatro podem entregar valor antes disso.

**Arquivamento e desarquivamento com efeito em estoque: requer revisão.** Os bloqueios são o crédito por declaração (P1-01), o saldo ainda gravável fora da função (P1-02), o cargo gravável na política local (P1-03) e o produto sem prova de organização (P1-04). O desenho transacional do plano permanece utilizável depois que o documento incorporar as correções da seção 6.

Esta auditoria não autoriza implementar. O painel pode ser a primeira implementação quando o plano registrar as condições de consulta. O arquivamento com estoque espera o plano revisado e as provas da seção 7.
