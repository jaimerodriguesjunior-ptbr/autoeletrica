# Auditoria v3 — plano de fluxo visual 2,5D e arquivamento de OS

**Data:** 09/11/2026.  
**Objeto:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.  
**Identificação do arquivo lido:** versão 3, data-base 09/11/2026, 854 linhas, 103.520 bytes, gravado em 09/11/2026 18:12:26. SHA-256 `F4337A4BC8C5468F32222D121F05E34BD6B99EB38D2E86240A6806A72F5EB6F9`.  
**Histórico conferido, sem edição:** versão 2 auditada com SHA-256 `0063572E6B20B48EE32BD80DA75FCF9A030DF4FED2F2569336B2FDA729C080FB`; relatório v2 com SHA-256 `6CD95B2156855EBF6C1A13EEC3D9EDD8B451E6E91E74449ED5CEEA8B07D4001A`; primeiro relatório com SHA-256 `65389A52E239D03B30093855180150AB135CFFC103C3C53F3CF175897B2DF2A2`.  
**Método:** leitura de `AGENTS.md`, de `CONTEXTO_NUVEM_LOCAL_FISCAL.md`, do plano vigente e dos relatórios anteriores; leitura do código e das migrações locais. Nenhuma funcionalidade foi implementada, nenhuma migração foi aplicada e o banco remoto não foi consultado.

**Legenda.** Fato é o que o repositório mostra nesta leitura. Proposta é o que a versão 3 descreve e a seção 22 ainda deixa em aberto. Decisão de negócio é escolha do usuário, ainda sem aceite registrado. Hipótese é cenário cujo resultado depende de dado ou privilégio não lido no banco instalado.

## 1. Identificação e parecer inicial

A versão 3 continua sendo revisão documental. Não há rota `fluxo-visual`, status `arquivado`, colunas de débito rastreado nem funções de estoque no código de aplicação. A busca por esses nomes em `*.ts`, `*.tsx` e `*.sql` não encontrou implementação.

O cabeçalho identifica a versão 3 e preserva o hash da versão 2 informado pelo auditor anterior. A seção 26 descreve respostas documentais; ela não é prova de correção no software.

| Bloco | Plano para desenvolver em ambiente isolado | Habilitação com dados reais |
| --- | --- | --- |
| Painel de consulta | Apto com condições. Cinco filas, idade desde `created_at`, recorte de OS com veículo e o contrato de busca da seção 8.1 já podem ser codados com dados de teste. | Ainda não. Falta provar, no banco instalado, que o usuário não troca a própria afiliação. A fila de peça pode nascer vazia. |
| Lembretes | Apto com condições. O relógio contínuo, a persistência por usuário e a ausência de aviso com o aplicativo fechado estão descritos. A sugestão fica desligada sem X. | Ainda não. X, a cadência, a estimativa de orçamento antigo e a escrita protegida da política continuam em aberto. A ação manual espera a escolha de D01. |
| Arquivamento e estoque de linhas novas | Apto com condições. A tabela da seção 11.6 fecha o ciclo de uma linha já classificada como `known`. Dá para exercitar esse contrato em banco isolado, como proposta. | Ainda não. Faltam o guarda provado, inclusive `DELETE` de produto, a identidade do executor e as provas de concorrência. |
| Tratamento do legado | Apto com condições para ensaio isolado do comportamento de uma linha `legacy_unknown`. A migração que escolhe quais linhas recebem essa classe ainda precisa do predicado do achado P2-V3-01. | Ainda não. Sem D06 e D18 aceitas, e sem esse predicado, OS antigas não entram na ação publicada. |

Nenhuma linha está pronta para produção. Este parecer não autoriza implementar, publicar ou migrar dados reais.

Os 69 registros abertos da NHT continuam sendo informação do usuário. Esta leitura não os contou e não os separou por status, veículo ou baixa.

### Limitações

- Grants, RLS efetivo, triggers instalados, constraints de status e existência de um ledger no banco remoto permanecem não verificados. `schema.json` e o código divergem: a fotografia local de `work_orders` não lista `tipo`, `employee_id` nem `payment_intent`; a de `work_order_items` não lista `marca` nem `catalog_status`. O código já grava esses campos.
- `work_orders.id` na fotografia local é `bigint`. A tela mostra `String(id).slice(0, 4)`. O tipo instalado não foi lido.
- `quantity` e `estoque_atual` aparecem como `numeric` na fotografia local. O plano acerta ao não tratar quantidade como inteiro.
- Não houve teste de concorrência. Os interleavings abaixo são leitura estática.
- Não houve medição de blur, teclado ou rolagem em celular ou tablet.
- Não houve acesso a credenciais nem ao banco remoto. A migração aberta em `otica-gestao` ficou fora do escopo.

## 2. Achados novos ou persistentes

### P2-V3-01 — A migração ainda não diz quais linhas nascem como legado

- **Natureza:** lacuna da proposta. O ciclo de uma linha já rotulada está na seção 11.6. Falta o predicado que aplica o rótulo.
- **Bloco:** legado e corte dos escritores.
- **Seção:** 11.2, 11.5 e a linha “Criar” de `L` na seção 11.6.
- **Código:** `app/(admin)/os/detalhes/[id]/page.tsx`. Só `tipo === "peca"` mexe em `estoque_atual` (inclusão por volta da linha 1274, remoção 759, alternância 806, cancelamento 882, exclusão 938). Serviço entra com `tipo: "servico"` e `product_id` nulo (linha 1248). `schema.json` não exige `tipo`.

**Fato.** Não há ledger local. A frase “a migração identifica a linha antiga” não distingue peça, serviço, peça do cliente, catálogo pendente e tipo ausente.

**Proposta.** Peça antiga sem prova fica `legacy_unknown` com `D = NULL`. Serviço e peça do cliente não creditam. Linha nova `no_debit` tem zero conhecido. Essas frases cabem em classificações diferentes para o mesmo registro antigo.

**Cenário.** No corte existem quatro linhas: peça de loja com `product_id`, peça com `peca_cliente = true`, serviço e linha com `tipo` vazio.

1. Tratar a peça do cliente como `known` / `managed` / `D = 0` faz a desmarcação debitar `Q`, pela coluna `K` da seção 11.6. O saldo muda sem baixa comprovada.
2. Tratar todo serviço como `legacy_unknown` impede aumentar a quantidade na mesma linha, embora o código atual não use serviço para alterar saldo.
3. Um default `NOT NULL` de zero na coluna nova converte a ausência em zero conhecido e reabre o ciclo misto que a versão 3 quis encerrar.

**Efeito.** A fase 2 pode gravar a classe errada antes do primeiro movimento novo. D06 e D18 não escolhem esse `WHERE`.

**Confiança:** alta no texto e no código local. A distribuição real das linhas não foi lida.

**Correção mínima.** No mesmo comando da migração, sem default zero:

- Linha já existente com `tipo = 'peca'`, ou com `tipo` nulo ou diferente de `servico`: `legacy_unknown`, `stock_debited_qty = NULL`, nenhum movimento. Vale com ou sem `product_id`, com `peca_cliente` verdadeiro e com catálogo `pending`.
- Linha já existente com `tipo = 'servico'`: `known`, modo `no_debit`, débito zero conhecido, nenhum movimento. A ausência de efeito de estoque vem do tipo, que o código já separa.
- Inclusão posterior segue só a coluna `K`. Ela nunca grava `legacy_unknown`.
- A coluna aceita `NULL`. Preencher zero e ligar um booleano depois não substitui esse predicado.

### P2-V3-02 — Excluir o produto ainda apaga saldo fora do protocolo

- **Natureza:** lacuna da proposta de contenção.
- **Bloco:** estoque.
- **Seção:** 11.3, que exige recusa de `INSERT`, `UPDATE` e dos dois ramos de `UPSERT`.
- **Código:** `app/(admin)/estoque/[id]/page.tsx`, linhas 174–178, apaga a linha de `products`. O próprio catch trata violação de chave estrangeira quando o produto está em uma OS. Produto sem item referenciado é excluído. Os demais escritores absolutos continuam nos pontos já citados na auditoria v2: detalhes da OS, `estoque/novo`, `estoque/importar`, `estoque/[id]` no `UPDATE` da linha 152, `nova-venda` e `recibo/[id]`.

**Cenário.** O guarda rejeita `INSERT` e `UPDATE` de `estoque_atual`. O usuário exclui um produto que tem saldo e não está vinculado a item. O número deixa de existir sem movimento. Recriar o produto é outro `INSERT`, sujeito ao guarda, mas o saldo anterior já sumiu.

**Efeito.** A contenção de saldo fica incompleta. `BYPASSRLS` não é o furo: `DELETE` simplesmente não passa pelo gatilho de `INSERT`/`UPDATE`.

**Confiança:** alta no código local. O `ON DELETE` instalado da FK de `product_id` não foi lido; o cliente já espera erro de FK quando há OS.

**Correção mínima.** O mesmo executor recusa `DELETE` de `products` fora da função. A baixa definitiva do cadastro é uma operação explícita, com movimento de encerramento, versão e saldo de referência. Movimentos novos não usam FK que apague o histórico quando o produto ou o item some.

### P2-V3-03 — O predicado fiscal a evitar não é só o arquivo antigo

- **Natureza:** lacuna de proposta, com dois gatilhos locais divergentes.
- **Bloco:** arquivamento e vínculos.
- **Seção:** 12, que cita `migration_prevent_duplicate_fiscal_invoice_per_os.sql`.
- **Código:** esse arquivo, linhas 8 e 17–19, considera ativas só `draft`, `processing` e `authorized`, e só `NFCe`/`NFSe`. O arquivo posterior `migration_prevent_duplicate_product_sale_per_os.sql` substitui a mesma função. Nas linhas 37–47 ele inclui `pending` e, em seguida, dá `RETURN NEW` para NF-e que não seja venda. `error` e `rejected` também passam direto. `src/lib/work-order-fiscal.ts`, linha 10, mantém `pending` entre os quatro status ativos. A emissão grava `authorized`, `processing`, `pending`, `draft`, `error`, `rejected` e `cancelled`.

**Proposta.** A seção 12 já diz a regra certa: os quatro status ativos, qualquer tipo e ambiente, natureza especial inclusa, e estado incerto bloqueado. O cancelamento na Nuvem Local Fiscal continua fora do arquivamento.

**Cenário.** Quem procura no repositório o predicado “já corrigido” encontra a migração mais nova, vê `pending` e reutiliza a função. Uma NF-e de remessa, devolução ou retorno vinculada à OS, ou uma nota `rejected`, não impede o arquivamento.

**Efeito.** A resposta ao P2-V2-01 fica certa no parágrafo e fácil de implementar pela metade. O nome legado “Nuvem Fiscal” no código não muda essa leitura: o vínculo é local.

**Confiança:** alta nos dois arquivos locais. Qual das funções está instalada no banco remoto é desconhecido.

**Correção mínima.** Nomear as duas migrações como predicados incompletos. O guarda de arquivamento não chama nenhuma delas. Bloqueia documento vinculado em status não terminal confirmado, inclusive natureza especial e `pending`. `cancelled` confirmado, sem outra obrigação, não bloqueia. Lista permissiva montada a partir desses arquivos não serve.

### P2-V3-04 — O cliente administrativo pode executar a função sem ser o usuário

- **Natureza:** lacuna de mecanismo. O desenho do gatilho em contexto de invocador é implementável; a porta de entrada ainda cabe no padrão atual do servidor.
- **Bloco:** estoque, arquivamento e leitura privilegiada.
- **Seção:** 11.3 e 13.
- **Código:** `src/actions/os.ts`, linhas 42–93, lê o perfil com o cliente do usuário e depois usa `createAdminClient()` para apagar comissões e gravar `pronto`. `app/api/os/create/route.ts` e `app/api/portal/aprovar/route.ts` também gravam com o cliente administrativo. `get_my_organization_id()` em `migration_rls_multi_tenant.sql`, linhas 16–24, é `SECURITY DEFINER` e devolve `profiles.organization_id` de `auth.uid()`.

**Proposta.** Função definidora de um papel `NOLOGIN`, gatilho invocador olhando `current_user`, sem GUC livre. Papéis expostos não assumem o executor.

**Cenário.** A rota confirma o usuário e chama a função com o cliente de serviço, passando o id do ator no argumento. Dentro da função definidora, `current_user` é o executor, então o gatilho autoriza a escrita. `auth.uid()` vem vazio nessa chamada. O argumento faz o papel de sessão. Quem possui a chave de serviço, ou um defeito da rota, escolhe o ator. Assumir o papel com `SET ROLE` é outro teste e não cobre este.

**Efeito.** O guarda de saldo passa a proteger o navegador e continua aberto para o padrão de servidor que o projeto já usa.

**Confiança:** alta como leitura do mecanismo proposto e do padrão local. Os grants reais de `EXECUTE` não foram lidos.

**Correção mínima.** A função de mutação lê `auth.uid()`, recusa nulo e não recebe ator, organização nem cargo por argumento. `EXECUTE` fica com `authenticated`, na sessão do JWT do usuário. `PUBLIC`, `anon` e o papel do cliente administrativo perdem `EXECUTE`. O gatilho continua invocador e compara `current_user` ao dono `NOLOGIN`. Provar também que esses papéis não são membros do executor, não alteram o dono, não desligam o gatilho e não definem `session_replication_role`. Os gatilhos definidores já existentes em `products` (`prevent_duplicate_product_catalog_entry` e `sync_product_to_global_catalog`) não escrevem saldo e não podem passar a escrever.

### P3-V3-01 — O predicado do painel cita tipo sem fixar o valor

- **Natureza:** lacuna de proposta de consulta.
- **Bloco:** painel.
- **Seção:** 4.3, 5 e 8. A seção 8 manda a contagem usar o mesmo predicado de tipo; a tabela da seção 5 não diz qual.
- **Código:** `app/api/os/create/route.ts`, linha 42, grava `tipo: "os"` com veículo obrigatório. `venda-direta` grava `tipo: "bancada"` e `vehicle_id: null`. `nova-venda` grava `tipo: "venda_balcao"`, `vehicle_id: null` e `status: "entregue"`.

**Cenário.** Uma bancada ou venda recebe veículo depois, por correção de dados, e permanece em status aberto. O filtro “tem veículo e está em uma das cinco filas” desenha um carro. A seção 4.3 pede que essas OS fiquem fora da cena.

**Efeito.** O recorte visual deixa de coincidir com o texto do produto. Não altera estoque.

**Confiança:** alta no código de criação. Não foi lido se alguma OS real já mistura tipo e veículo.

**Correção mínima.** Inclusão do carro e do contador: `tipo = 'os'`, `vehicle_id` preenchido, um dos cinco status, organização da sessão. `bancada` e `venda_balcao` continuam nas listas próprias.

### P3-V3-02 — A saída da fase 0 ainda se apresenta como versão 2

- **Natureza:** lapso documental.
- **Bloco:** plano.
- **Seção:** 19, fase 0, última frase da saída.
- **Código:** nenhum.

**Cenário.** O leitor usa a fase 0 para saber qual texto está vigente e trata o miolo do arquivo como se ainda fosse a versão auditada em segundo lugar.

**Efeito.** Confusão de versão. O cabeçalho e a seção 26 já identificam a versão 3. O conteúdo técnico da fase, de que o código não foi corrigido, continua válido.

**Confiança:** alta.

**Correção mínima.** Trocar a frase para versão 3.

### O que foi conferido e não virou achado novo

- A tabela 11.6 percorre criar, preço, quantidade, peça do cliente, troca de produto, catálogo, remoção, cancelamento, arquivar, desarquivar e arquivar de novo. `NULL` não é convertido por `COALESCE(D, Q)` em nenhum exemplo. Duas linhas do mesmo produto permanecem distintas.
- O sinal do delta fica determinado pelo exemplo 5 da seção 11.7 e pelo critério da seção 20: estoque aumenta em `D_atual - D_alvo` quando esse número é positivo. Reduzir a linha `managed` de 3 para 1 devolve 2.
- Remover item hoje é `delete` na linha 774 do detalhe. `work_order_item_assignments.work_order_item_id` e o item de comissão têm `ON DELETE CASCADE` em `migration_comissoes.sql`. A seção 11.6 já exige preservar identificador, evento e movimento. Cumprir essa frase impede reutilizar o `delete` atual como implementação.
- `reopenOS` continua apagando comissões pendentes antes de escrever `pronto`, sem ler o status. A seção 13 mantém a ordem exigida.
- Aprovação do portal lê `orcamento` e atualiza por `id`, com `payment_intent`, sem transação. A seção 12 separa intenção de pagamento de adiantamento. `handleAdiantamento`, por volta da linha 1160, insere `transactions` com `paid` ou `pending`.
- Checkout grava `entregue` na linha 1000 e só depois insere as transações na linha 1002. A matriz da seção 16 continua exigindo a mesma trava e a validação antes do efeito.
- Há dois `INSERT` de `appointments.work_order_id`: detalhes, linha 1645, e `agendamentos/page.tsx`, linha 263. A seção 16 cobre os dois. O conjunto local de status, depois de `migration_add_confirmado_status.sql`, é `agendado`, `confirmado`, `em_atendimento`, `concluido`, `cancelado` e `nao_compareceu`. D10 lista os três primeiros como impeditivos. O conjunto instalado segue não verificado.
- Extrato soma OS que não estão `cancelado` (`app/api/portal/extrato/route.ts`, linhas 66–68). A agenda atrasada do dashboard exclui só `entregue` e `cancelado` (linhas 122–133). A contagem geral, linhas 83–85, não filtra organização e deixa `pronto` fora da “fila”. O plano pede contador próprio.
- Busca da lista, `ServiceOrderList.tsx` linhas 47–53 e 151–163, usa trecho do id, cliente, modelo e placa normalizada. Placa normalizada vazia faz `includes("")` e casa todas as placas. A seção 8.1 fecha esse caso para a consulta nova.
- `profiles_update_own` em `fix_profiles_rls.sql` e em `migration_rls_multi_tenant.sql` atualiza a própria linha sem proteger `cargo`, `organization_id` e `ativo`. `app/api/admin/users/route.ts` trata `cargo === 'owner'` como autoridade e, na ação `update_profile`, grava o cargo recebido. A seção 13 cita essa rota. `reopenOS` normaliza o cargo com `toLowerCase()`; a rota administrativa compara `'owner'` sem normalizar.
- Não há comando de tela que grave `aguardando_peca`. O cartão de peças chama `em_servico`. D17 permanece decisão.
- Não há Three.js em `package.json`. O painel cabe em imagem, HTML e CSS.
- Arquivar, no texto, não cancela documento na Nuvem Local Fiscal, não estorna pagamento e não apaga agendamento.

## 3. Reavaliação dos achados da versão 2

“Suficiente” aqui é resposta do documento. Nenhum item foi corrigido no sistema. Nenhuma resposta que a auditoria v2 considerou suficiente foi retirada. A separação de D01 torna explícito que o prazo da sugestão não proíbe, por si, a ação manual; a seção 9.3 mantém a ação desligada até essa escolha. Isso não enfraquece o guarda.

| ID | Resposta documental da versão 3 | Leitura desta auditoria | Prova futura |
| --- | --- | --- | --- |
| P1-V2-01 | Seções 11.6 e 11.7 separam linha conhecida com número, zero conhecido e legado com `NULL`, e percorrem as mutações. | Suficiente para uma linha já classificada. Parcial na migração, pelo P2-V3-01. D18 continua sem aceite. | Banco isolado percorre os seis passos da seção 11.7 e o predicado de migração, sem `COALESCE(D, Q)`. |
| P2-V2-01 | Seção 12 inclui `pending`, todos os tipos e ambientes, e mantém estado incerto bloqueado. | Parcial. A regra da seção 12 está certa e nomeia só a migração antiga. A função posterior ainda libera natureza especial, `error` e `rejected`. Ver P2-V3-03. | Nota `pending`, NF-e de remessa e status `rejected` impedem arquivar; `cancelled` confirmado não impede. |
| P2-V2-02 | Seção 11.3 cobre `INSERT`, `UPDATE` e `UPSERT`, inclusive saldo zero, com executor dedicado e gatilho invocador. | Parcial. O trio de escrita da coluna está descrito. `DELETE` do produto e a chamada pelo cliente administrativo ficaram de fora. Ver P2-V3-02 e P2-V3-04. | Insert direto, upsert, update absoluto, delete de produto e chamada com papel de serviço são recusados; a função com JWT aplica o delta. |
| P2-V2-03 | Seção 8.1 define trecho literal do id, cliente, modelo e placa normalizada, antes do cursor, com o mesmo predicado de contagem. | Suficiente. O contrato acompanha a lista e corrige o termo de placa vazio. | OS depois da primeira página encontrada pelos quatro caracteres exibidos e pela placa com hífen; `%` e `_` literais; erro de contagem visível. |
| P3-V2-01 | Seção 11.4.1 devolve o sucesso confirmado da mesma chave e do mesmo conteúdo, antes da condição de status. Conteúdo diferente conflita. O cliente busca o estado corrente depois. | Suficiente. Chave antiga depois de desarquivar não manda a interface esconder uma OS ativa. A chave continua sem ser credencial. | Perda de resposta, replay, conteúdo divergente e replay depois de outro ciclo, com autorização ainda exigida. |

A matriz da primeira auditoria, como atualizada na versão 2, permanece de pé nestes pontos: P1-01 suficiente quanto a retirar o crédito por declaração; P1-03 parcial até a prova de afiliação; P1-04 suficiente no algoritmo de organização; P2-01, P2-03, P2-04, P2-05, P3-01 e P3-02 suficientes no texto, com as decisões ainda abertas que a seção 5 abaixo repete. P1-02 e P2-02 continuam parciais pelos achados novos de contenção e pela prova, ainda não feita, de que todo vínculo compartilha a trava da OS.

## 4. Revisão das seções 11.6, 11.7 e 26

### O contrato de linhas separadas

A versão 3 elimina o estado ambíguo dentro da mesma linha. Uma linha é `known` com `D` numérico, inclusive zero, ou `legacy_unknown` com `D` nulo. A OS pode ter as duas, até para o mesmo produto. Isso responde à lacuna P1-V2-01 para o ciclo operacional.

O aumento de quantidade na linha antiga é rejeitado. A quantidade extra nasce em outra linha `known`, com débito explícito. Reduzir, remover, cancelar ou alternar a linha antiga muda orçamento e histórico e não mexe no saldo. Arquivar grava `C` a partir de `D` da linha conhecida e não recalcula `C` por `Q`. Desarquivar debita `C`. O ciclo seguinte usa o débito então aplicado.

Essa restrição é proporcional ao objetivo de não inventar saldo, e é visível: a oficina deixa de receber estoque ao apagar uma peça antiga e deixa de editar “2 para 5” na mesma linha. Por isso D18 é aceite, não detalhe técnico. D06 só decide se a OS que contém linha antiga pode mudar de status sem crédito. Uma não substitui a outra.

Há um efeito técnico que não depende de D18. Linha nova `no_debit` também deixa de creditar `item.quantity` quando alguém marca peça do cliente. O código atual faz esse crédito mesmo quando a inclusão usou `baixarEstoque = false` (`handleCadastrarEAdicionarPeca` chama `handleAdicionarItem(..., false)` na linha 1363). Parar esse crédito faz parte do contrato de linha conhecida.

O mecanismo de privilégio é implementável em PostgreSQL: função `SECURITY DEFINER` de um papel `NOLOGIN`, gatilho `BEFORE INSERT OR UPDATE` em contexto de invocador, `current_user` igual a esse papel, e recusa quando a escrita vem de outro papel. `BYPASSRLS` não desliga gatilho. Isso precisa ser provado no banco isolado e, antes de dados reais, no conjunto instalado. A seção 26 acerta ao dizer que o parágrafo não é a prova. O P2-V3-04 completa a porta de entrada que o parágrafo ainda não fixou.

A seção 26 não regride as respostas anteriores. Ela registra limite e decisão pendente em cada linha. A afirmação de que o contrato não foi aprovado pelo auditor da versão 2 está correta: linhas separadas são proposta do autor desta revisão.

### Alternativa, só se a linha extra for recusada

Não recomendo substituir o desenho. Se o usuário recusar D18 por causa da segunda linha, o substituto abaixo é o contrato completo. Implementar “preservar o desconhecido” sem estes campos volta a ter duas leituras.

Na mesma linha: `Q` comercial positivo; `legacy_unproven` imutável; `D` numérico do débito comprovado ainda aplicado; modo `managed` ou `no_debit`. Zero com a flag ligada é componente comprovado vazio mais parcela antiga desconhecida. Zero com a flag desligada é ausência conhecida de baixa. Nunca usar `COALESCE(D, Q)`.

- Migração de peça ou tipo desconhecido: flag ligada, `D = 0`, sem movimento.
- Migração de serviço: flag desligada, modo `no_debit`, `D = 0`, sem movimento.
- Linha nova de loja em `managed`: flag desligada, debitar `Q`, `D = Q`.
- Linha nova sem baixa: flag desligada, `D = 0`, sem saldo.
- Aumentar `Q` com flag desligada e peça da loja: debitar só o acréscimo.
- Aumentar `Q` com flag ligada: debitar só o acréscimo, somar esse acréscimo a `D`, flag permanece.
- Diminuir `Q`: creditar `min(redução, D)`; o resto da redução é só comercial; flag permanece.
- Marcar peça do cliente: creditar o `D` atual e gravar `D = 0`.
- Desmarcar: se a flag estiver desligada e o modo for `managed`, debitar `Q`. Se a flag estiver ligada, debitar apenas o valor creditado na marcação, que é o `D` anterior, e não debitar `Q` inteiro.
- Remover ou cancelar: creditar só `D`.
- Arquivar e desarquivar: usar `C = D` do ciclo, como na seção 11.6. A flag atravessa os ciclos.

Troca de produto continua sendo remoção mais inclusão na mesma transação.

## 5. D01 a D18

| ID | Tipo | Efeito se ficar sem escolha | O que trava |
| --- | --- | --- | --- |
| D01 | Negócio, em duas partes. X dispara a sugestão. Separadamente, a ação manual pode ser livre em orçamento ou também exigir X. 30 dias é exemplo. | Sugestão desligada. Ação manual também fica desligada, pela seção 9.3, até a escolha. | Não impede desenvolver o painel. Impede habilitar sugestão e botão. |
| D02 | Negócio. Intervalo de 3 dias ou dias fixos. | Lembrete não é habilitado. | Não impede o painel. |
| D03 | Negócio, apresentação. | Pode haver faixa provisória no ensaio visual, identificada como proposta. | Não impede o ensaio isolado. Impede tratar a cor como política da oficina. |
| D04 | Negócio depois da prova técnica. Proposta: `owner`, `admin`, `gerente`. | Ação administrativa não é habilitada. | Impede habilitar arquivar. A consulta pode seguir o acesso atual às OS depois da afiliação protegida. |
| D05 | Negócio. `created_at` como estimativa identificada, ou contagem só a partir da implantação. | Lembrete de OS antiga não apresenta uma data como se fosse evento comprovado. | Impede habilitar o lembrete para o legado. Não impede o relógio das OS novas. |
| D06 | Negócio. Proposta: arquivar linha antiga sem movimento de saldo. | OS com qualquer linha `legacy_unknown` não arquiva. | Impede habilitar arquivamento dessas OS. Não decide remoção nem cancelamento. |
| D07 | Técnica. Conter os escritores da seção 11.3, mais o `DELETE` do P2-V3-02 e a porta do P2-V3-04. | O ensaio isolado pode existir. A publicação não. | Impede habilitar qualquer crédito ou débito novo. |
| D08 | Negócio. Proposta: desarquivar tudo ou nada quando faltar saldo. | Reativação com baixa parcial não é habilitada. | Impede habilitar desarquivar. O bloqueio integral pode ser codado como proposta. |
| D09 | Negócio na margem; o bloqueio de obrigação ativa ou incerta é a proposta segura. | Arquivamento com pendência financeira ou fiscal não é habilitado. | Impede habilitar a ação. O guarda da seção 12 pode ser codado em banco isolado. |
| D10 | Negócio no conjunto de status. A proposta local coincide com a migração que adiciona `confirmado`. | Compromisso ativo não é ignorado por suposição. | Impede habilitar. Confirmar o check instalado antes da publicação. |
| D11 | Negócio. Escopo inicial com veículo. | Bancada fica fora do botão e fora do carro. | Não impede o painel das OS com veículo. |
| D12 | Negócio, nome. “Fluxo visual” já está no texto. | Não bloqueia o ensaio se o rótulo provisório for o do plano. | Não impede desenvolver. |
| D13 | Técnica, já especificada. Mais antigas primeiro, desempate por id, página de 20, busca no servidor. | Nenhuma escolha nova. O tamanho pode mudar depois de medir. | Não impede. |
| D14 | Negócio futura. A baixa na solicitação explícita continua. Reserva só após aprovação seria outro projeto. | O contrato 11.6 mantém a baixa no modo `managed`. | Não impede este plano. Não misturar com o arquivo. |
| D15 | Negócio de apresentação. Card estático com contador real separado. | O ensaio pode usar a proposta. | Não impede o painel. Impede publicar a miniatura como se fosse a cena ao vivo. |
| D16 | Negócio com efeito visível. Proposta: bloquear exclusão permanente de arquivada e de OS com histórico ou movimento. | O botão atual, que devolve `quantity` e apaga a OS, não pode conviver com o ledger. | Impede habilitar o corte. O bloqueio pode ser ensaiado. |
| D17 | Negócio. Comando de `aguardando_peca` ou fila só de leitura. | A fila pode ser publicada vazia, com estado vazio honesto. | Não impede as outras quatro filas. O comando, se escolhido, é entrega de escrita separada. |
| D18 | Negócio. Aceite do ciclo da seção 11.6, inclusive segunda linha e fim da devolução por `quantity` no legado. | Escritores publicados não mudam o comportamento da linha antiga. | Impede publicar o corte. O ensaio isolado da proposta pode ocorrer sem apresentar isso como regra da oficina. |

## 6. Alterações mínimas no documento

Sem editar o plano nesta auditoria:

- **Seção 11.6.** Incluir o `WHERE` do P2-V3-01 e a proibição de default zero.
- **Seção 11.3.** Incluir `DELETE` de `products` e a regra de `auth.uid()` do P2-V3-04. Uma frase: todos os escritores travam produtos por id em ordem crescente e aplicam incremento atômico; a soma dos `C` entra uma vez no saldo.
- **Seção 12.** Citar também `migration_prevent_duplicate_product_sale_per_os.sql` como predicado que não deve ser copiado.
- **Seção 5.** Fixar `tipo = 'os'` junto do veículo e dos cinco status.
- **Seção 19.** Corrigir a auto-referência “versão 2”.
- **Seção 26.** Registrar P2-V3-01 a P2-V3-04 como limites desta revisão, no mesmo espírito da tabela atual.

Não abrir compra, reserva, lote, motor 3D nem reconstrução de ledger histórico para desenhar o painel.

## 7. Provas e critérios de implantação

Executar depois, em banco isolado, com dados fictícios. Não usar a NHT nem emissão fiscal de produção como teste.

### Consulta, antes de dados reais

- Cinco filas, `pronto` incluído, uma OS por carro, duas OS da mesma placa, sem veículo e sem `tipo` de bancada ou balcão.
- Status desconhecido permanece na lista, fora das filas.
- Fila de peça vazia quando não houver registro.
- Busca pelos quatro caracteres exibidos e pela placa com hífen acha a OS fora da primeira página. Contagem usa o mesmo filtro. Falha de contagem não vira zero.
- Termo só com pontuação não casa todas as placas. `%` e `_` são literais.
- Usuário que altera o próprio `organization_id`, `cargo` ou `ativo` não passa a ver outra oficina. Este prova depende do banco em que a política for instalada.

### Estoque e arquivamento, antes de habilitar

- Migração segue o predicado do P2-V3-01 e não cria movimento.
- Os passos numéricos da seção 11.7, mais linha `no_debit`, serviço, peça do cliente e duas linhas do mesmo produto.
- Replay da mesma chave devolve o sucesso original sem segundo crédito. Chave antiga, depois de desarquivar, não esconde a OS ativa. Conteúdo diferente conflita.
- Duas sessões, venda contra arquivamento, aprovação por token contra arquivamento, adiantamento e agenda contra a prévia. Uma transição vence. Não há item, saldo nem transação parcial.
- `INSERT`, `UPDATE`, `UPSERT` e `DELETE` diretos de saldo, com papel `authenticated` e com o cliente administrativo, são recusados.
- Nota `pending`, NF-e de natureza especial e status incerto bloqueiam. Arquivar não chama cancelamento na Nuvem Local Fiscal.
- `reopenOS`, checkout, exclusão e os dois caminhos de agenda obedecem à mesma trava.

### Reversão

Desligar ações novas e manter a leitura do status `arquivado`. Os gatilhos de saldo e de status permanecem durante a volta do código. Não somar estoque de novo por um rollback genérico e não apagar movimentos.

Publicar a consulta não exige ligar os escritores.

## 8. Parecer final por bloco

**Painel de consulta: apto com condições.** Dá para desenvolver a leitura em ambiente isolado. Habilitar com dados reais espera afiliação protegida, busca da seção 8.1, contador que não vira zero, recorte `tipo = 'os'` com veículo e fila de peça como leitura. D17 não bloqueia as outras filas. D03, D13 e D15 afinam a apresentação.

**Lembretes: apto com condições.** O desenho separa idade visual e tempo contínuo em orçamento, não reinicia o prazo quando a descrição muda e não promete aviso com o aplicativo fechado. Habilitar espera D01, D02, D05 e política com escrita protegida.

**Arquivamento com estoque: apto com condições para ensaio isolado.** O ciclo das linhas já classificadas pode ser codado como proposta. Habilitar espera D04, D06, D07, D08, D09, D10, D16, D18, os achados P2-V3-02 e P2-V3-04, e as provas da seção 7. A restrição de prazo da ação manual segue D01.

**Legado: apto com condições para ensaio da linha `NULL`.** Publicar espera o predicado do P2-V3-01 e o aceite separado de D06 e D18. Sem esses aceites, a OS antiga permanece fora da ação.

Plano apto para desenvolvimento isolado não é funcionalidade implementada e não é autorização para implementá-la.

### Decisões que o usuário precisa tomar

1. D01: qual é X, e se a ação manual pode acontecer antes de X.
2. D02 e D03: cadência do lembrete e faixas de cor.
3. D04: quem arquiva, depois da proteção de cargo.
4. D05: estimativa identificada por `created_at` ou contagem só depois da implantação.
5. D06: arquivar orçamento antigo sem devolver a parcela desconhecida, ou deixar essas OS bloqueadas.
6. D18: aceitar a segunda linha e o fim da devolução automática ao reduzir, remover, cancelar ou alternar peça antiga. Se recusar, o substituto é o contrato de flag da seção 4, não uma frase genérica.
7. D08, D09, D10 e D16: bloqueio integral ao desarquivar, pendências que impedem arquivar, agenda e fim da exclusão permanente.
8. D17: comando de “aguardando peça” agora, ou fila vazia até outra entrega.
9. D11, D12 e D15 podem acompanhar o ensaio visual. D14 fica fora deste recurso.

### Bloqueios técnicos que não são escolha do usuário

- Provar no banco instalado a proteção de `organization_id`, `cargo` e `ativo`, e o efeito disso em `get_my_organization_id()` e em `app/api/admin/users/route.ts`.
- Instalar o guarda de saldo para inserção, atualização, upsert e exclusão, com `auth.uid()` e sem `EXECUTE` para o cliente administrativo.
- Aplicar o predicado de migração sem fabricar débito.
- Confirmar constraints reais de status de OS, de agendamento e de nota, e se existe ledger não visto nestes arquivos.
- Ensaiar a concorrência da seção 7 antes de qualquer crédito em dados reais.
- A contagem das OS da NHT, se for necessária para o piloto, é leitura agregada posterior. Ela não é pré-requisito do desenho do painel e não foi feita aqui.
