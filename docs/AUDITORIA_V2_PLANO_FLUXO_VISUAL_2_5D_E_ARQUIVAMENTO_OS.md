# Auditoria v2 — plano de fluxo visual 2,5D e arquivamento de OS

**Data:** 09/11/2026.  
**Objeto:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.  
**Identificação do arquivo auditado:** versão 2, data-base 09/11/2026, 734 linhas, 80.016 bytes, gravado em 09/11/2026 16:29:11. SHA-256 `0063572E6B20B48EE32BD80DA75FCF9A030DF4FED2F2569336B2FDA729C080FB`.  
**Histórico preservado:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md` (SHA-256 `EB0763C2C6DD75F778BC1FB8F905DBFAA894113785EEE5D6F770EFA0F21A3223`) e `docs/AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md` (SHA-256 `65389A52E239D03B30093855180150AB135CFFC103C3C53F3CF175897B2DF2A2`). Este relatório não os edita.  
**Método:** leitura de `AGENTS.md`, de `CONTEXTO_NUVEM_LOCAL_FISCAL.md`, do plano vigente, da versão 1 e da primeira auditoria; leitura do código e das migrações locais. Nenhuma funcionalidade foi implementada, nenhuma migração foi aplicada e o banco remoto não foi consultado.

**Legenda.** Fato é o que o repositório mostra nesta leitura. Proposta é o que a versão 2 descreve e a seção 22 ainda deixa em aberto. Decisão de negócio é escolha do usuário, ainda não registrada como aprovada. Hipótese é cenário cujo resultado depende de dado ou privilégio não lido no banco instalado.

## 1. Identificação e parecer inicial

A versão 2 é uma revisão documental. Não há rota `fluxo-visual`, status `arquivado`, coluna `stock_debited_qty` nem estado `legacy_unknown` no código de aplicação. Essas expressões aparecem nos documentos do plano. O código de estoque, status, perfil e fiscal continua no desenho anterior.

| Bloco | Plano para desenvolver em ambiente isolado | Habilitação com dados reais |
| --- | --- | --- |
| Painel de consulta | Apto com condições. As cinco filas, a cor pela idade desde `created_at`, o recorte de OS com veículo e a busca no servidor estão definidos o bastante para codar com dados de teste. | Ainda não. Falta provar, no banco instalado, que o usuário não troca a própria afiliação. A fila de peça pode nascer vazia. |
| Lembretes | Apto com condições. O relógio contínuo, a persistência por usuário e o limite de “quem não abre o sistema não recebe aviso” estão descritos. | Ainda não. X, a cadência e a estimativa de orçamento antigo continuam em aberto, e a escrita da política precisa de privilégio protegido. |
| Arquivamento e desarquivamento com estoque | Requer revisão. A transação, a versão, a igualdade de organização e a recusa de crédito por declaração avançaram. O ciclo de item legado misturado com débito novo ainda não diz o que acontece em edição, remoção, peça do cliente e novo arquivamento. | Ainda não. Além do contrato, faltam os guardas no banco e as provas de concorrência. |
| Tratamento do legado | A recomendação de arquivar a parcela desconhecida sem movimento de estoque evita o crédito inventado da versão 1. Continua pendente de decisão e, sozinha, não fecha o ciclo de mutação. | Ainda não. Sem a decisão e sem o contrato do ciclo, OS com parcela desconhecida permanecem fora da ação. |

Nenhuma dessas linhas está pronta para produção. Aprovação deste relatório não autoriza implementar.

Os 69 registros abertos da NHT continuam sendo informação do usuário. Esta leitura não os contou e não os separou por status, veículo ou baixa.

### Limitações

- Grants, RLS efetivo, triggers instalados, constraints de status e existência de um ledger no banco remoto permanecem não verificados. `schema.json` e `schema_types.txt` são fotografias locais. O código já usa `tipo`, `employee_id`, `payment_intent` e `catalog_status`, que essa fotografia de `work_orders` não lista.
- Não houve teste de concorrência. Os interleavings abaixo são leitura estática dos escritores e do algoritmo proposto.
- Não houve medição de blur, teclado ou rolagem em celular ou tablet.
- Não houve acesso a credenciais nem ao banco remoto.

## 2. Achados novos ou persistentes

### P1-V2-01 — O ciclo do item misto não tem fórmula

- **Natureza:** lacuna da proposta. O crédito por declaração da versão 1 foi retirado; o que falta é o contrato das mutações que alimentam `stock_debited_qty`.
- **Bloco:** arquivamento, desarquivamento e legado.
- **Seção da versão 2:** 10.3, 11.2, 11.4 passo 7, 11.5 e a linha “OS mista” da seção 20.
- **Código:** `app/(admin)/os/detalhes/[id]/page.tsx`. Remoção credita `item.quantity` nas linhas 759–770. A alternância de peça do cliente soma ou subtrai `item.quantity` nas linhas 805–818. Cancelamento e exclusão repetem essa soma nas linhas 881–893 e 936–949. A edição de quantidade, linhas 3467–3469, grava `quantity` e o total e não mexe no saldo. A inclusão com `baixarEstoque = false`, linha 1363, cria `product_id` sem baixa.

**Fato.** Não há tabela de movimento no código pesquisado nem em `schema.json`. `product_id`, `quantity` e `catalog_status = resolved` coexistem com inclusão sem baixa.

**Proposta.** A versão 2 diz que a parcela desconhecida não vira crédito no arquivamento nem débito no desarquivamento, e que edição ou remoção posteriores “devem manter essa separação”. O exemplo numérico da seção 20 parte de um débito já conhecido de 1, soma um delta de 2 e libera 3. Esse exemplo não cobre parcela desconhecida.

**Cenário.** OS antiga em `orcamento`, um item com `quantity = 2`, `product_id` preenchido, sem movimento. O estado proposto é `legacy_unknown`. Duas implementações cabem no texto atual:

1. Remover o item credita 2, porque o escritor atual credita `item.quantity`, e grava esse crédito como movimento. A parcela desconhecida passa a parecer comprovada. Um arquivamento seguinte pode creditar de novo, ou o próprio remove já aumenta o saldo sem baixa original.
2. Remover o item credita 0, porque `stock_debited_qty` foi gravado como 0. O saldo não muda. Isso evita estoque inventado e também muda o que a oficina vê hoje ao apagar a peça. O texto não diz qual das duas a fase 2 deve fazer.

O mesmo vale para alternar “peça do cliente” e voltar: o código atual lança `+quantity` e depois `-quantity`. Se esses lançamentos virarem débito comprovado, a ida e volta transforma desconhecido em conhecido. Na edição de 2 para 5, delta calculado como `5 - 0` debita 5 e absorve as 2 unidades não comprovadas; delta calculado só sobre movimento novo debitaria 3 e deixaria as 2 desconhecidas. A seção 20 não escolhe.

Arquivar, desarquivar e arquivar de novo tem uma frase de preservação do flag no passo 7 da seção 11.4 e na seção 10.3. Zerar o componente rastreado, porém, deixa `stock_debited_qty = 0`. Se alguma leitura tratar 0 como “sabemos que nada foi baixado” e descartar `legacy_unknown`, o ciclo seguinte perde a parcela.

**Efeito.** A fase 2, ao trocar os escritores absolutos, precisa dessa fórmula antes de gravar o primeiro movimento. Sem ela, o campo que o arquivamento vai creditar nasce errado. A decisão D06, mesmo se aceita, só fala do momento de arquivar.

**Confiança:** alta no texto e no código local. Quantas OS da NHT têm essa mistura não foi lido no banco.

**Correção mínima no documento.** Fixar o par de campos, sem preencher número por migração:

- Item novo com baixa na mesma transação: estado conhecido e `stock_debited_qty` igual ao delta aplicado.
- Item novo sem baixa, serviço ou peça do cliente: estado conhecido e débito 0. Esse 0 é prova de ausência de baixa.
- Item antigo sem movimento: `legacy_unknown` e quantidade comprovada ausente, distinta de 0. Não copiar `quantity`.
- Alterar preço ou quantidade comercial, sozinho, não gera delta e não preenche a ausência.
- Incluir, devolver ou alternar estoque numa linha antiga só movimenta o componente já comprovado por movimento novo. A ausência continua ausência.
- Remover, cancelar ou excluir devolve só o componente comprovado ainda aplicado. A parcela ausente não gera movimento.
- Arquivar credita só esse componente, registra o valor no ciclo e mantém o flag. Desarquivar debita só o que aquele ciclo creditou. Arquivar outra vez repete a regra sobre o componente então aplicado.
- Se D06 não for aceita, OS com qualquer parcela ausente não arquiva.

A troca da fase 2 também precisa dizer à oficina que apagar ou cancelar item antigo deixa de devolver `item.quantity` automaticamente. Isso é efeito visível da contenção dos escritores, anterior ao botão de arquivar. A alternativa de continuar devolvendo `quantity` e marcar o movimento como não comprovado também precisa estar escrita, se for a escolhida. As duas não podem ficar implícitas.

### P2-V2-01 — A lista fiscal da proposta não acompanha o status ativo já usado no código

- **Natureza:** lacuna da proposta, com divergência já presente no repositório.
- **Bloco:** arquivamento e vínculos.
- **Seção da versão 2:** 12 e D09.
- **Código:** `src/lib/work-order-fiscal.ts`, linha 10, define `ACTIVE_FISCAL_STATUSES` como `authorized`, `processing`, `draft` e `pending`. O cartão só oferece emissão em `pronto` ou `entregue` (`components/os/WorkOrderFiscalCard.tsx`, linha 60). `src/actions/fiscal_emission.ts` grava `fiscal_invoices.work_order_id` nos fluxos de emissão e, no trecho lido em torno da linha 4144, usa a OS para completar o tomador sem exigir status da OS. A migração `migration_prevent_duplicate_fiscal_invoice_per_os.sql`, linhas 8 e 17–19, trata como ativas apenas `draft`, `processing` e `authorized`, e só para `NFCe` e `NFSe`. `pending` passa por esse gatilho, e `NFe` também.

**Cenário.** Uma NFC-e ou NFS-e da OS está `pending`. O arquivamento consulta só `draft`, `processing` e `authorized`, encontra vazio e libera o orçamento. Ou copia o predicado do gatilho e ignora uma NF-e autorizada vinculada à OS.

**Efeito.** Orçamento arquivado com obrigação fiscal ainda viva. A Nuvem Local Fiscal não precisa ser chamada para isso acontecer: o buraco é o vínculo local. A versão 2 acerta ao proibir cancelamento de documento e ao dizer que estado desconhecido bloqueia. A lista nomeada de três status, se implementada como conjunto fechado, contradiz essa frase e omite `pending`, que o próprio aplicativo já trata como ativo.

**Confiança:** alta no código local. O conjunto instalado em produção pode ter outros literais; isso continua não verificado.

**Correção mínima.** O bloqueio parte do conjunto que o código já chama de ativo, inclusive `pending`, em qualquer `tipo_documento` e ambiente, e só libera status terminais confirmados. `error` e `rejected` continuam bloqueando enquanto o desfecho não estiver confirmado. Nota cancelada permanece como histórico e não bloqueia se não houver outra obrigação. O gatilho de duplicidade não serve de predicado pronto para o arquivamento.

### P2-V2-02 — A recusa de saldo ainda pode ser lida como um gatilho só de UPDATE

- **Natureza:** lacuna de mecanismo na proposta. O requisito de recusar escrita direta está na seção 11.3; o corte de `INSERT` não está explícito.
- **Bloco:** estoque.
- **Seção da versão 2:** 11.3, fase 2 e a linha de escritor absoluto da seção 20.
- **Código:** escritas absolutas que continuam no cliente, todas com leitura seguida de gravação do valor, salvo o `INSERT` que já nasce com o número:
  - `app/(admin)/os/detalhes/[id]/page.tsx`, linhas 1274–1286, 759–770, 805–818, 881–893 e 936–949.
  - O mesmo arquivo insere produto com `estoque_atual: 0` no cadastro rápido, no cadastro global e no scanner (linhas 1347, 1432 e 1517) antes de eventualmente debitar.
  - `app/(admin)/estoque/novo/page.tsx`, linhas 193–200, insere o saldo digitado. O vínculo de item pendente, linhas 210–221, só preenche `product_id` e `catalog_status`.
  - `app/(admin)/estoque/importar/page.tsx`, linhas 511–517, insere `estoque_atual: item.qCom`; linhas 534–537 atualizam saldo anterior mais `qCom`.
  - `app/(admin)/estoque/[id]/page.tsx` grava o saldo digitado.
  - `app/(admin)/atendimento/nova-venda/page.tsx`, linhas 391–398, subtrai `item.qtd`.
  - `app/(admin)/recibo/[id]/page.tsx`, linhas 118–125, soma `item.quantity` ao cancelar.

`src/actions/fiscal_db.ts` atualiza NCM, não saldo. Não há RPC de estoque. A despesa gravada na importação, linhas 580–589 de `estoque/importar/page.tsx`, não leva `work_order_id`.

**Cenário.** O banco recusa `UPDATE` de `estoque_atual` fora da função nova. A tela de produto novo e o ramo “criar” da importação fazem `INSERT` com a quantidade da nota. O saldo nasce fora do protocolo. Em seguida, um arquivamento aplica delta sobre um número que a função não viu nascer.

**Efeito.** A contenção pedida pelo P1-02 da primeira auditoria fica pela metade. Cliente administrativo usa a mesma tabela; RLS não vê essa inserção se o papel ignora RLS, e um gatilho só de `UPDATE` também não a vê.

**Confiança:** alta no código local. Privilegio efetivo de `INSERT` no projeto instalado não foi lido.

**Correção mínima.** A recusa cobre `INSERT`, `UPDATE` e `UPSERT` da coluna. O menor mecanismo auditável, sem reescrever o módulo de compras:

1. Uma função `SECURITY DEFINER`, dona de um papel que não é `authenticated`, `anon` nem o papel do cliente administrativo, aplica o delta ou o ajuste explícito e grava o movimento na mesma transação.
2. Um gatilho `BEFORE INSERT OR UPDATE` em `products` rejeita mudança de `estoque_atual` quando `current_user` não é esse dono. O mesmo padrão rejeita mutação de item com efeito de saldo e transição de entrada ou saída de `arquivado` quando a escrita não passa pela função.
3. Não usar variável de sessão que o PostgREST consiga definir com `set_config`, nem função auxiliar exposta que ligue essa variável. O nome do marcador não é barreira.
4. A função confere perfil ativo, afiliação protegida, organização de OS, item e produto, e a permissão da operação. `BYPASSRLS` não desliga gatilho; isso precisa ser confirmado no banco, assim como a impossibilidade de o papel exposto usar `session_replication_role`.
5. O cliente antigo falha na primeira sentença. Inclusão de item, baixa e total deixam de ser três chamadas. O gatilho e a tela que chama a função saem no mesmo lançamento, para a oficina não ficar sem lançar peça entre a migração e o front.

Saldo inicial e entrada de nota continuam existindo como ajuste explícito, com origem e versão, dentro da função. Revogar a coluna sem retirar o `GRANT UPDATE` da tabela não substitui o gatilho.

### P2-V2-03 — A busca do painel não herda a correspondência que a lista já usa

- **Natureza:** lacuna da proposta de consulta.
- **Bloco:** painel.
- **Seção da versão 2:** 7.2 e 8.
- **Código:** `components/atendimento/ServiceOrderList.tsx`, linhas 47–53 e 151–163, filtra no navegador por trecho do id, nome do cliente, modelo e placa normalizada, sem pontuação e em maiúsculas. O cabeçalho da OS em `app/(admin)/os/detalhes/[id]/page.tsx`, linha 1746, mostra só `String(id).slice(0, 4)` em maiúsculas. A lista de OS e a impressão também encurtam o id em outros cortes.

**Cenário.** A fila tem 60 OS. O usuário digita os quatro caracteres que vê no detalhe, ou a placa com hífen. A consulta nova exige UUID inteiro, ou compara a placa ao texto cru. A OS existe fora da primeira página e a resposta volta vazia. O contador, se usar outro predicado, ainda pode mostrar um total diferente do resultado.

**Efeito.** O critério “achar a 45ª OS” passa num teste com UUID completo e falha no código que a oficina enxerga.

**Confiança:** alta como condição de contrato. O tipo real do `id` no banco instalado não foi lido; o código trata o valor como texto pesquisável por trecho.

**Correção mínima.** A busca no servidor, antes do cursor, usa o mesmo critério da lista: trecho do identificador, nome do cliente, modelo textual e placa só com letras e números. Contagem e página usam esse predicado. Erro de contagem permanece erro, como a seção 4.2 já pede para o card.

### P3-V2-01 — A mesma chave, depois de perda de resposta, não tem o resultado de retorno definido

- **Natureza:** refinamento da proposta.
- **Bloco:** arquivamento.
- **Seção da versão 2:** 11.4 passo 3 e a linha de repetição da seção 20.
- **Código:** não há chave de operação hoje. O risco nasce na implementação.

**Cenário.** O servidor confirma o arquivamento e a resposta se perde. O cliente repete a mesma chave. O saldo não muda outra vez, porque o passo 3 e o status impedem segundo crédito. Se a resposta da repetição for erro, a tela pode gerar outra chave. A segunda chave encontra status diferente de `orcamento` e também não credita. O dado fica certo e o operador vê falha.

**Efeito.** Operação concluída tratada como pendente. Não duplica estoque se o `WHERE status = 'orcamento'` estiver na mesma transação da chave.

**Confiança:** alta na leitura do algoritmo.

**Correção mínima.** A mesma chave e o mesmo conteúdo devolvem o resultado já confirmado. Conteúdo diferente na mesma chave devolve conflito, como a seção 11.4 já diz. Chave nova após sucesso devolve conflito de estado, sem movimento.

### O que foi conferido e não virou achado novo

- Não há comando de tela que grave `aguardando_peca`. O cartão “Peças / Insumos”, linhas 1845–1853 do detalhe, pinta o passo e o botão chama `handleStatusChange('em_servico')`. `handleStatusChange`, linhas 700–707, grava o status recebido sem olhar a origem. Criação grava `orcamento`, portal grava `aprovado`, checkout grava `entregue`, bancada nasce `aprovado`, venda de balcão nasce `entregue`. D17 descreve o fato certo: a fila pode ser publicada vazia, e um comando novo é outra entrega, com origens e destinos.
- `reopenOS` em `src/actions/os.ts`, linhas 44–93, apaga comissões pendentes e grava `pronto` sem ler o status. A versão 2 exige a leitura antes de qualquer efeito. O contrato está concreto.
- A aprovação do portal, `app/api/portal/aprovar/route.ts`, linhas 26–41, lê `orcamento` e atualiza por `id`, com cliente administrativo, gravando `payment_intent`. A versão 2 pede escrita condicional na mesma trava da OS. `payment_intent` continua distinto de transação.
- O extrato, `app/api/portal/extrato/route.ts`, linhas 66–68, soma `total` de toda OS que não está `cancelado`. A agenda atrasada do dashboard, linhas 122–133, exclui só `entregue` e `cancelado` e usa `previsao_entrega`. A versão 2 manda excluir `arquivado` nas duas e não apagar agendamento.
- A contagem geral do dashboard, linhas 83–93, não filtra organização na consulta e depende do RLS. Ela também mistura OS sem veículo e deixa `pronto` de fora da “fila”. O card novo não pode reutilizar esse número. A versão 2 já pede contador próprio, com o recorte do painel, e erro diferente de zero.
- O total da OS aparece na lista (`ServiceOrderList.tsx` formata `os.total`) e no detalhe. O faturamento agregado do dashboard só aparece para `cargo === 'owner'`. A seção 7.3 acompanha a lista. Isso responde ao P3-01.
- Não há Three.js em `package.json`. O painel cabe em imagem, HTML e CSS.
- Duas OS da mesma placa continuam sendo duas linhas. O scanner abre direto só quando há uma OS aberta (`ServiceOrderList.tsx`, linhas 203–214). `ja_tem_os` é tipo de agendamento, nas migrações `migration_add_type_ja_tem_os.sql` e `migration_fix_appointment_type.sql`.
- Nenhum caminho lido grava status de volta para `orcamento`. A estimativa por `created_at` para quem ainda está em orçamento é compatível com as telas. Um `UPDATE` antigo feito fora do repositório continuaria invisível.
- Arquivar não estorna pagamento, não cancela documento na Nuvem Local Fiscal e não apaga agendamento, no texto da versão 2. Isso acompanha o contexto fiscal obrigatório.

## 3. Matriz de reavaliação dos onze IDs anteriores

“Suficiente” aqui é resposta do documento. Nenhum item foi corrigido no sistema.

| ID | Resposta documental | Decisão ainda aberta | Evidência futura |
| --- | --- | --- | --- |
| P1-01 | Suficiente quanto a retirar o formulário que transformava declaração em crédito. A versão 1, seção 11.5, gravava a quantidade “ainda debitada” e usava o resultado na mesma transação. A versão 2 proíbe isso. | D06, e o efeito colateral de remoção/cancelamento do P1-V2-01. | Prova, em banco isolado, de que legado não gera movimento e de que o ciclo misto segue a fórmula que o documento ainda precisa receber. |
| P1-02 | Parcial. A recusa no banco, inclusive cliente administrativo, entrou na seção 11.3, e a lista de arquivos cobre os escritores achados. `INSERT` e a troca coordenada ainda podem ser implementados pela metade. Ver P2-V2-02. | Nenhuma de negócio. O mecanismo técnico recomendado está na correção desse achado. | Gatilho disparado para `authenticated` e para o papel administrativo; `INSERT` antigo rejeitado; chamada direta não deixa item nem saldo parcial. |
| P1-03 | Parcial, no ponto certo. A versão 2 exige proteção de `cargo`, `organization_id` e `ativo` antes de confiar na coluna, também para a consulta. O texto não nomeia o consumidor que já existe. | Quem arquiva, D04, só depois da trava. | Ver abaixo. Grants e triggers reais. |
| P1-04 | Suficiente no algoritmo. O passo 6 da seção 11.4 aborta sem delta se item ou produto não for da organização da OS. FK composta fica como reforço posterior, depois de achar linhas cruzadas sem corrigi-las por suposição. | Nenhuma. | Teste negativo com produto de outra organização e leitura das FKs instaladas. |
| P2-01 | Suficiente. D17 existe, a fila vazia é permitida e o comando, se houver, é entrega de escrita separada. O código confirma a ausência de gravador. | D17: criar o comando ou aceitar a fila como leitura. | Contagem remota de `aguardando_peca`, só para não prometer que a fila está vazia. |
| P2-02 | Parcial, próxima do suficiente. A matriz nomeia `reopenOS`, adiantamento, `handleSalvarAgendamento`, checkout, exclusão do cabeçalho e emissão direta, e a seção 13 pede a mesma trava da OS. | D09 e D10. | O guarda precisa estar no `INSERT` das tabelas. A agenda também insere `work_order_id` em `app/(admin)/agendamentos/page.tsx`, linhas 263–272. O checkout grava `entregue` na linha 1000 antes de inserir as transações na linha 1002. |
| P2-03 | Suficiente como contrato. Versão monotônica no banco, prévia com essa versão, `updated_at` afastado. Não há trigger local de `work_orders.updated_at`; o dashboard ainda usa esse campo como mês de conclusão, linhas 87–90. | Nenhuma. | Coluna incrementada por status, item e débito; prévia recusada quando o item muda. |
| P2-04 | Suficiente na frase da seção 8, com o complemento do P2-V2-03 sobre trecho de id e placa normalizada. | Nenhuma de negócio. O tamanho 20 continua ajustável depois de medir. | OS fora da primeira página encontrada pelo texto que o usuário vê; contagem igual à página; erro de contagem visível. |
| P2-05 | Suficiente na proposta de estados e na recusa de guardar X em `company_settings` enquanto qualquer membro puder atualizar a tabela. A política local, `migration_rls_multi_tenant.sql`, linhas 207–213, continua assim. | D01, D02 e D10. O conjunto instalado de status de agendamento. | Constraint real de `appointments.status` e escrita da política recusada para funcionário. |
| P3-01 | Suficiente. Seção 7.3 segue lista e detalhe. | Nenhuma. | O painel mostra o total de quem já abre a OS e não mostra o faturamento agregado do dashboard. |
| P3-02 | Suficiente. A faixa de 8 a 16 dias saiu da seção 23. O painel tem ordem de grandeza própria; estoque ficou sem prazo fechado. | Nenhuma. | A estimativa de escrita só depois do diagnóstico de grants e do contrato do P1-V2-01. |

### P1-03 e a afiliação da leitura

Fato local. `get_my_organization_id()` é `SECURITY DEFINER` e lê `profiles.organization_id` (`migration_rls_multi_tenant.sql`, linhas 16–24). `profiles_update_own`, linhas 120–121, permite `UPDATE` da própria linha com `id = auth.uid()` e sem restrição de coluna. Não há trigger de `profiles` nas migrações lidas. `src/contexts/AuthContext.tsx`, linhas 61–66, só desliga `ativo = false` no navegador. `app/api/admin/users/route.ts`, linhas 40–48, trata como dono quem tem `cargo === 'owner'` lido pelo cliente do usuário e, a partir daí, usa a chave administrativa para criar usuário e alterar cargo e `ativo`.

Hipótese, até ler o banco. Se o `GRANT` deixar o `UPDATE`, o usuário grava outra `organization_id` na própria linha. A função passa a devolver a organização nova, e as políticas de OS, itens, produtos e clientes acompanham. Ler esse valor no servidor, para o painel novo, repete a afiliação adulterada. Esconder o botão não entra nessa sequência.

A versão 2 diz isso na seção 8 e pede a proteção antes de dados reais. A condição cobre o painel de leitura. Ela só vale quando a coluna for imutável para o papel comum, ou quando a organização usada na consulta vier de um campo que esse papel não grava. Conferir cargo dentro da função de arquivar, e deixar `profiles_update_own` como está, não fecha o painel nem a rota administrativa já existente.

Não dá para afirmar que a produção esteja aberta. Também não dá para tratar a política local como inofensiva. Se o privilégio instalado permitir o `UPDATE`, o achado original sobe a P0 na habilitação.

## 4. Revisão da seção 25

A tabela de rastreabilidade corresponde ao que mudou entre a versão 1 e a versão 2. Ela separa “escrito no plano” de “feito no software”. Essa distinção está correta. Nenhum achado antigo foi rebaixado por ter ganhado um parágrafo.

Os dois refinamentos também procedem, com um limite:

1. “Editar quantidade não muda crédito” vale para edição comercial sem movimento, e o delta novo de um item já conhecido muda débito e crédito juntos. O exemplo 1 + 2 = 3 da seção 20 está nesse segundo caso. O refinamento não responde o item `legacy_unknown`, em que não existe o 1 inicial. P1-V2-01 continua aberto.
2. Indicador interno só serve se o papel exposto não conseguir ligá-lo. Uma variável de sessão não é essa prova. O mecanismo da seção 2 deste relatório, baseado no `current_user` da função definidora, atende o refinamento sem criar um interruptor chamável pelo PostgREST.

A conclusão documental da seção 25, painel avançável como consulta e arquivamento fechado, continua válida para o painel. Para o estoque, “fechado” deve incluir o contrato do ciclo misto, que a seção 25 ainda não lista.

## 5. D01–D17

| ID | Classe | Impede desenvolver o bloco | Impede habilitar |
| --- | --- | --- | --- |
| D01 | Negócio. X não foi escolhido. A proposta de recusar arquivar antes de X é mais estreita do que “sugerir depois de X”: a ação manual também ficaria presa ao prazo. | Não impede o painel. Impede ligar lembrete e ação. | Sim, para lembrete e arquivamento. |
| D02 | Negócio. Três dias ou dois dias fixos. O plano já diz que quem não abre o sistema não recebe as duas exibições. | Não. A persistência no servidor pode ser codada com o intervalo em aberto. | Sim, para o lembrete. |
| D03 | Negócio para as cores; o relógio técnico já está proposto em blocos de 24 horas no servidor, exibido em `America/Sao_Paulo`, com texto e cor neutra para data inválida. | Não, se a implementação usar as faixas sugeridas como padrão inicial. | Não, desde que idade textual exista. |
| D04 | Negócio sobre o grupo; a trava da coluna é técnica e anterior. | A função pode ser escrita contra um grupo configurável. O grupo real espera a oficina. | Sim. |
| D05 | Técnica com ressalva de dado. `created_at` rotulado, sem fingir evento, combina com as telas lidas. Começar a contar na implantação adia todos os orçamentos antigos. | Não impede o painel, que usa `created_at` para a cor. | Sim, para o lembrete, se a oficina não aceitar a estimativa. |
| D06 | Negócio. A recomendação técnica é não creditar parcela desconhecida. Ela é coerente com “liberar só o que foi baixado” e diferente de “todo produto selecionado volta para a prateleira”. | Impede fechar a fase de estoque enquanto o P1-V2-01 não disser o que remoção e alternância fazem. | Sim. Sem aceite, OS com parcela desconhecida não arquiva. |
| D07 | Técnica. A lista de escritores locais foi confirmada, com o acréscimo de que `INSERT` também grava saldo. | O protocolo pode ser desenvolvido em banco isolado com o mecanismo da P2-V2-02. | Sim, até a prova de recusa. |
| D08 | Técnica, com efeito de negócio já alinhado ao risco. Bloquear o desarquivamento inteiro quando faltar saldo para repor exatamente o último ciclo. Não repor metade e não gravar negativo nesse caminho. | Não. A regra já pode ser o contrato. | Não, se essa regra for a adotada na implementação. |
| D09 | Negócio apenas na exceção “arquivar orçamento que já tem sinal”. O bloqueio de obrigação ativa ou incerta é a proposta segura e ainda não foi aprovado. | O guarda pode ser codado com a lista corrigida do P2-V2-01. | Sim, até a oficina aceitar ou recusar a exceção do sinal. |
| D10 | Negócio se a oficina preferir só avisar. A proposta segura é impedir enquanto houver `agendado`, `confirmado` ou `em_atendimento`, sem cancelar a linha. | O guarda pode ser codado assim. | Sim, se a oficina quiser só o aviso. |
| D11 | Negócio já compatível com o recorte visual. Primeira ação só em OS com veículo e `orcamento`. | Não impede o painel. | Não para a consulta. Ampliar bancada fica para depois, sem carro. |
| D12 | Negócio já alinhado. “Fluxo visual”. | Não. Pode ser fechado. | Não. |
| D13 | Técnica. Mais antigas primeiro, desempate por id, página de 20, busca no servidor. | Não, com o complemento do P2-V2-03. | Não. |
| D14 | Negócio. Manter a baixa no momento em que o fluxo atual pede baixa, inclusive a exceção `baixarEstoque = false`. Mudar para reserva só após aprovação é outro projeto. | Não impede este plano se o comportamento atual permanecer. | Só se a oficina quiser mudar o momento da baixa. |
| D15 | Negócio já compatível. Miniatura ilustrada, rótulo de prévia e contador separado. | Não. | Não, além de produzir a imagem. |
| D16 | Técnica. Bloquear exclusão permanente de arquivada e impedir segunda devolução pelo fluxo antigo. | Não. É requisito do status. | Sim, até o guarda existir no banco. |
| D17 | Negócio. Comando explícito, com origens e destinos, ou fila só de leitura. | Não impede as outras quatro filas. O comando, se aprovado, não entra na entrega de consulta. | Não para publicar a fila vazia com legenda honesta. |

## 6. Escopo mínimo e fases

O painel não depende de refazer estoque, de ledger histórico, de Realtime, de engine 3D, de cor por oficina nem de inventário da NHT.

**Pode começar em ambiente isolado.** A consulta: uma rota, cinco filas dos status atuais, uma OS por carro, OS sem veículo fora do desenho, cor desde `created_at` com texto, seleção com foco e retorno do foco, filas com rolagem própria, card estático com “Prévia ilustrativa” e contador que falha sem virar zero. Dados de teste. A afiliação usada no teste é fixa.

**Precisa de contrato mais concreto antes de codar os escritores.** A fórmula do P1-V2-01 e a inclusão de `INSERT` na recusa de saldo. Sem isso, a fase 2 escolhe sozinha se apagar peça antiga devolve quantidade.

**Pode ficar fora.** Corrigir saldos históricos. Reconstruir ledger do passado. Arquivar em lote. Arquivar bancada. Cancelar nota, estornar adiantamento ou apagar agendamento. Reescrever `get_dashboard_metrics`. O KPI antigo do dashboard, que não filtra organização na consulta e não usa o recorte de veículo, permanece manutenção anterior. O card novo não o aproveita. Ajustar aquele KPI só entra se alguém mexer nessa consulta.

**Sequência que o documento já separa e que esta leitura mantém.**

1. Consulta visual, sem aceitar `arquivado`.
2. Colunas, versão, eventos, função de saldo e gatilhos, ainda sem botão de arquivar. Itens novos passam a ter débito comprovado. Itens antigos nascem como desconhecidos, sem movimento inventado.
3. Arquivar e lembrete, só depois de D01, D02, D04, D06, D08, D09, D10 e D16, e das provas da seção 8 deste relatório.
4. Piloto da consulta primeiro. Crédito de estoque depois, numa organização, sem lote e sem legado creditado.

A fase 2 quebra a tela antiga de propósito: a aba aberta recebe erro em vez de gravar metade. Por isso o front que chama a função e o gatilho sobem juntos.

## 7. Mudanças recomendadas no documento

O plano vigente não foi editado. As inclusões abaixo são para uma revisão posterior.

- **Seção 8.** Dizer que a busca repete o critério da lista: trecho do id, placa normalizada, modelo e cliente, no servidor, antes do cursor. Contagem com o mesmo predicado.
- **Seção 10.3 e 11.5.** Incluir a tabela de estados do P1-V2-01: conhecido com número, conhecido com zero e desconhecido com ausência. Percorrer adicionar, diminuir, remover, alternar peça do cliente, arquivar, desarquivar e arquivar de novo.
- **Seção 11.3.** Escrever `INSERT` e `UPSERT` ao lado de `UPDATE`. Nomear o gatilho por `current_user` da função definidora e a proibição de variável de sessão. Dizer que o lançamento do gatilho acompanha o cliente novo.
- **Seção 12.** Incluir `pending` na lista ativa e dizer que NF-e vinculada entra no mesmo guarda. O gatilho de duplicidade local não é a lista completa.
- **Seção 16.** Acrescentar o `INSERT` de `app/(admin)/agendamentos/page.tsx`. Uma linha basta: todo `INSERT` em `appointments` com `work_order_id` passa pela trava, não só `handleSalvarAgendamento`.
- **Seção 20.** Acrescentar os casos do ciclo misto, do `INSERT` de saldo, da busca pelos quatro caracteres exibidos e da repetição da mesma chave devolvendo o resultado já gravado.
- **Seção 22, D01.** Separar “avisar depois de X” de “proibir arquivar antes de X”.
- **Seção 22, D06.** Incluir a frase de que, na contenção dos escritores, apagar ou cancelar item antigo também deixa de devolver `quantity` automaticamente, salvo se o documento escolher o movimento marcado como não comprovado.
- **Seção 25.** Registrar o P1-V2-01 como lacuna ainda aberta do refinamento 1.

## 8. Critérios verificáveis de habilitação e reversão

Provas de produto ficam separadas das provas de banco. Nenhuma foi executada nesta auditoria. As que escrevem dados usam banco isolado.

### Consulta, antes de dados reais

- OS com veículo em cada um dos cinco status cai só na própria fila. `pronto` permanece. `cancelado`, `entregue` e, quando existir, `arquivado` ficam fora.
- Duas OS da mesma placa geram dois carros. OS sem veículo, bancada e venda não viram carro e seguem nas listas atuais.
- A busca pelos quatro caracteres exibidos no detalhe, e pela placa com hífen, encontra uma OS que não está na primeira página. O contador usa o mesmo filtro. Falha de contagem não aparece como zero.
- Data ausente, inválida ou futura não gera idade negativa. Trocar status não zera a idade desde `created_at`.
- O card diz que o desenho é ilustrativo. O número é o recorte “OS ativas com veículo”, diferente da fila do dashboard.
- Um `organization_id` na URL não amplia o resultado. Com a política instalada, um usuário que tente alterar `profiles.organization_id`, `cargo` ou `ativo` não muda a afiliação. Essa prova é leitura de grants, políticas e triggers no banco alvo, mais uma tentativa controlada em ambiente isolado.
- Teclado abre e fecha a seleção, o foco volta ao carro, e a rolagem horizontal fica dentro da fila. Redução de movimento não esconde dado. Blur medido num aparelho real da oficina, num contêiner, antes de afirmar fluidez.

### Estoque e arquivamento, antes de habilitar

- Item novo com baixa credita, no arquivamento, exatamente o débito ainda aplicado.
- Item novo com `baixarEstoque = false`, serviço e peça do cliente creditam zero conhecido.
- Edição comercial sem movimento não altera o crédito. Edição que aplica delta novo altera débito e crédito juntos.
- Item `legacy_unknown`: remover, alternar peça do cliente, cancelar, arquivar e desarquivar não criam movimento da quantidade comercial. O flag permanece. Arquivar de novo continua sem creditar essa parcela.
- OS mista libera só o componente comprovado.
- `INSERT` direto de `estoque_atual`, `UPDATE` absoluto e a mesma escrita pelo cliente administrativo são rejeitados. A inclusão antiga de item falha sem deixar item, total ou transação.
- Produto de outra organização aborta antes do primeiro delta.
- Duas sessões, mesma chave: um efeito, e a repetição devolve o resultado gravado. Chaves diferentes: uma transição, a outra encontra status diferente de `orcamento`.
- Aprovação pelo token concorrente: uma transição vence. Não existe OS `aprovado` com o crédito do arquivamento já aplicado.
- Adiantamento, agendamento da tela de agenda e vínculo fiscal inseridos durante a prévia compartilham a trava. Nota `pending` impede. Nota cancelada, sozinha, não impede e não é apagada.
- `reopenOS` não apaga comissão nem grava `pronto` se a origem for `arquivado`. Exclusão e cancelamento antigos não devolvem quantidade outra vez.
- Desarquivar sem saldo para todos os produtos do ciclo não muda status e não baixa parte. Com saldo, reaplica só o liberado no último ciclo. Falha no último item desfaz status, movimento e saldo.
- Quantidade 0,01 e saldo já negativo preservam a precisão. Este caminho de desarquivamento não grava negativo novo.
- Usuário inativo e usuário que tenha alterado o próprio cargo são recusados pela função.
- Extrato e agenda atrasada deixam a OS arquivada fora do total operacional. Histórico, impressão e busca por número ainda a encontram, com rótulo. Emissão nova contra ela é recusada no servidor. Documento já existente permanece. Nenhuma chamada de cancelamento sai para a Nuvem Local Fiscal.

### Reversão

Desligar o botão e o lembrete. Manter os gatilhos e a leitura de `arquivado`. Não recalcular saldos, não devolver status em massa e não apagar movimento. Código que trate `arquivado` como OS editável não volta enquanto existir linha nesse status.

## 9. Parecer final por bloco

**Painel de consulta: apto com condições.** Dá para desenvolver a leitura em ambiente isolado. As condições para habilitar com dados reais são a afiliação protegida, a busca no critério da lista, o contador que não vira zero e a fila de peça apresentada como leitura, vazia se for o caso. D17 não bloqueia as outras quatro filas.

**Lembretes: apto com condições.** O desenho não promete aviso com o aplicativo fechado e não reinicia o prazo quando a descrição muda. Habilitar espera X, a cadência, a aceitação da data aproximada e a escrita protegida da política.

**Arquivamento e desarquivamento com estoque: requer revisão.** A versão 2 fechou o crédito por declaração, a igualdade de organização, a versão monotônica e a lista principal de caminhos alternativos. O ciclo do item misto ainda não é implementável sem escolher uma fórmula. A recusa de saldo precisa incluir inserção. A lista fiscal precisa incluir `pending`.

**Legado: requer revisão.** A recomendação de mudar o status sem mexer na parcela desconhecida é a saída que evita estoque inventado. Ela ainda é decisão do usuário. Enquanto não houver aceite e contrato do ciclo, essas OS ficam de fora da ação.

Esta auditoria não autoriza implementar. Funcionalidade ausente do código não fica pronta para produção por estar bem descrita.

### Decisões que o usuário precisa tomar

- Quantos dias em orçamento disparam a sugestão, e se arquivar antes desse prazo também fica proibido.
- Cadência: intervalo de alguns dias ou dias fixos da semana, sabendo que quem não abrir o sistema não vê o aviso.
- Cores iniciais da idade, se quiser trocar as faixas sugeridas. O texto da idade permanece.
- Quem arquiva e desarquiva, depois que cargo e organização não puderem ser alterados pelo próprio usuário.
- Aceitar `created_at` rotulado como idade do orçamento antigo para o lembrete.
- Aceitar arquivar legado sem devolver a parcela desconhecida, e aceitar que apagar ou cancelar esse item também deixe de devolver a quantidade comercial sozinho. Ajuste de prateleira, se existir, é outro lançamento, com autor e motivo.
- Se um orçamento com sinal já pago pode ser arquivado. A proposta segura é impedir.
- Se compromisso `agendado`, `confirmado` ou `em_atendimento` impede o arquivamento ou apenas aparece no aviso. O sistema não cancela a agenda.
- Se a primeira ação fica só nas OS com veículo.
- Se a fila “Aguardando peça” permanece leitura dos registros que já existirem, ou se os detalhes ganham um comando com transições definidas.

Nome da tela, ordenação, miniatura ilustrativa e manutenção da baixa no momento atual podem seguir o plano. Não precisam de nova descoberta de código.

### Bloqueios técnicos que não são escolha do usuário

- Provar no banco instalado os grants, as políticas e os triggers de `profiles`, `products`, `work_orders`, `work_order_items`, `company_settings`, `transactions`, `appointments` e `fiscal_invoices`.
- Impedir que o papel comum altere `cargo`, `organization_id` e `ativo`, e fazer a função e a consulta usarem essa afiliação.
- Recusar `INSERT` e `UPDATE` diretos de `estoque_atual`, inclusive pelo cliente administrativo, com o gatilho ligado ao dono da função.
- Gravar versão monotônica e débito só de movimento novo, com a fórmula do item misto escrita antes da fase 2.
- Travar a OS nas transições, no portal, na reabertura, no adiantamento, nos dois pontos que criam agendamento e na inserção de nota.
- Executar as provas da seção 8 em banco isolado antes de qualquer organização real.
