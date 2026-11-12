# Prompt completo — auditoria de fechamento documental da versão 4

Você está em uma sessão independente, sem o histórico do chat. Avalie a versão 4 do plano de fluxo visual 2,5D e arquivamento de OS, confrontando o documento com o código local. É uma auditoria de proposta anterior à implementação, não um pedido para programar.

**Workspace:** `G:\projetos\autoeletrica`.

**Plano vigente:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`. Confira que o cabeçalho identifica a versão 4 e registre data/hash do arquivo efetivamente lido.

**Histórico disponível:**

- Planos preservados `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md`, `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V2_AUDITADO.md` e `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V3_AUDITADO.md`.
- Relatórios `docs/AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`, `docs/AUDITORIA_V2_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md` e `docs/AUDITORIA_V3_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- Estudos ilustrativos em `docs/referencias-fluxo-visual/`; algumas imagens antigas mostram quatro filas, mas o requisito atual tem cinco.

**Entrega nova:** `docs/AUDITORIA_V4_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`. Preserve os documentos anteriores. Se já houver um relatório nesse destino, crie nome numerado. Apresente os principais resultados também na resposta final.

## 1. Limites e método

Leia `AGENTS.md`. Antes de analisar emissão/integração fiscal, leia `CONTEXTO_NUVEM_LOCAL_FISCAL.md`. O projeto usa a Nuvem Local Fiscal; nomes legados não autorizam mudar provedor.

A única escrita autorizada é o relatório. Não edite o plano, código, imagens, configurações ou dados. Não implemente, aplique migrações, faça deploy ou execute rotinas com escrita em banco real. Não gere novos mockups.

Este prompt não autoriza acessar o banco remoto por encontrar credenciais. Se houver autorização adicional explícita, limite-se à leitura necessária de esquema/agregados. Sem ela, grants, RLS efetivo, triggers, constraints e dados instalados continuam não verificados. Não exponha segredos ou dados pessoais.

O painel, o status `arquivado`, o ledger e as funções propostas não foram implementados nesta sequência de elaboração. Confira o estado atual do código sem tratar a ausência de uma função futura como um defeito do plano por si só. Julgue se seus contratos, mecanismo e fases são suficientes para desenvolvimento isolado e o que ainda será exigido para habilitar dados reais.

Leia a versão 4 integralmente, produza sua análise própria e compare os relatórios. O plano não é prova de suas próprias afirmações; os relatórios anteriores também não substituem a evidência do código. Para reduzir repetição, reavalie os pontos já considerados suficientes quando houver mudança, contradição ou evidência nova, em vez de exigir outra redação por preferência pessoal.

Diferencie requisito, proposta pendente, fato local, hipótese e informação remota desconhecida. Não feche uma decisão de negócio em nome do usuário nem declare um problema de produção apenas pelo snapshot local.

## 2. Produto e escolhas que permanecem abertas

O painel representa o fluxo de OS, mesmo que o carro esteja com o cliente. Não controla presença física, vaga ou box. São cinco filas: `orcamento`, `aprovado`, `aguardando_peca`, `em_servico`, `pronto`.

Um carro genérico representa uma OS, sem imitar modelo ou cor reais. A cor significa idade desde `created_at`; trocar status não reinicia essa idade. Selecionar amplia o carro, atenua os demais e abre mais espaço para os dados. Celular/tablet devem funcionar com filas navegáveis e seleção acessível, usando imagens/HTML/CSS, sem engine 3D obrigatória.

Dashboard e Atendimento abrem a mesma tela. O dashboard usa um card como recorte de uma cena ilustrativa maior, com contador real separado. A inclusão proposta é `tipo = 'os'`, veículo preenchido, um dos cinco status e organização da sessão protegida. Bancada/balcão ficam fora mesmo se receberem veículo; tipo ausente não é convertido automaticamente.

O novo status `arquivado` não tem fila gráfica. O lojista decide arquivar; o sistema sugere após X dias em orçamento e reapresenta a revisão periodicamente. A negociação pode ser pessoal, sem envio registrado. Não há arquivamento silencioso por prazo nem novo status `recusado`.

Histórico e desarquivamento fazem parte da ideia. Liberar estoque exige prova da baixa. Arquivar legado sem crédito, usar nova linha para unidades adicionais antigas e deixar de devolver `quantity` ao remover/cancelar legado são propostas ainda dependentes de aceite.

Leia D01–D18 e confira se respostas efetivas do usuário foram registradas depois desta redação. Sem registro, continuam abertas. Em particular: X e restrição temporal da ação são escolhas separadas (D01); D06 decide arquivar legado sem crédito; D18 decide o ciclo das outras mutações. D04/D05/D08/D09/D10/D16/D17 também precisam de decisão conforme o bloco. Trinta dias, intervalo de três dias e grupo `owner/admin/gerente` são exemplos/propostas.

As 69 OS da NHT foram informadas pelo usuário, não contadas pelas auditorias. Não são prova de orçamento, presença física ou débito de estoque.

## 3. Histórico de auditoria e escopo desta rodada

A primeira auditoria encontrou crédito legado por declaração, escritores absolutos concorrentes, fragilidade da autoridade do perfil, produto sem organização comprovada e caminhos alternativos de status/vínculo. A segunda exigiu fechar o ciclo dos itens mistos, incluir inserção de saldo, `pending` fiscal, busca compatível e retorno idempotente.

A versão 3 adotou linhas separadas: `known` com débito numérico, inclusive zero conhecido, e `legacy_unknown` com `NULL`. A OS pode misturar linhas dessas origens, mas uma linha não mistura passado indeterminado e novo débito. A terceira auditoria considerou suficiente o ciclo de uma linha já classificada, a busca e o replay. Considerou os quatro blocos aptos com condições para ensaio isolado e nenhum pronto para dados reais. Isso não autorizou implementar.

O arquivo V3 auditado tem SHA-256 `F4337A4BC8C5468F32222D121F05E34BD6B99EB38D2E86240A6806A72F5EB6F9`. A versão 4 responde aos seguintes achados, sem corrigir o software:

| ID | Achado da terceira auditoria | Resposta que a V4 apresenta para você conferir |
| --- | --- | --- |
| P2-V3-01 | Classificação inicial do legado indefinida. | Seção 11.6.1: no lote existente, somente `tipo = 'servico'` vira `known/no_debit/0`; `tipo IS DISTINCT FROM 'servico'` vira `legacy_unknown/NULL`, inclusive peça do cliente, tipo ausente e catálogo pendente. Sem default zero nem movimento. Corte estável e reexecução protegida. |
| P2-V3-02 | Excluir produto remove saldo fora do protocolo. | `DELETE` incluído no guarda e escritores. Encerramento autorizado usa identidade, versão/saldo de referência, delta e histórico, sem cascata destrutiva; vínculo impeditivo desfaz tudo. |
| P2-V3-03 | A migração fiscal posterior também não serve como guarda geral. | Seção 12 nomeia as duas migrações de duplicidade. A mais nova inclui `pending` mas libera naturezas especiais e estados fora da lista ativa. O arquivamento tem guarda próprio, com todos os vínculos e estados incertos bloqueados. |
| P2-V3-04 | A função definidora poderia receber execução pelo cliente administrativo e ator por argumento. | `auth.uid()` obrigatório dentro da função, ator/organização/cargo derivados, sem esses argumentos. `EXECUTE` somente para sessão JWT de usuário autenticado, sem concessão efetiva a `PUBLIC`, `anon` ou papel de serviço. Rotas não chamam `createAdminClient().rpc` para substituir a sessão humana. |
| P3-V3-01 | Tipo do painel sem predicado exato. | `tipo = 'os'`, veículo, status e organização compõem o mesmo predicado de páginas e contagem. |
| P3-V3-02 | Fase 0 ainda chamava o texto de V2. | Autorreferência atualizada para V4. |

Essas respostas estão na seção 27. Não as considere suficientes sem examinar contratos e evidências. Não regrida a problemas antigos já resolvidos no texto sem apontar a contradição concreta.

## 4. Verificações obrigatórias de fechamento

### A. Classificação e ciclo dos itens

Confira se o predicado inicial é inequívoco, com `NULL` real, sem default zero temporário, sem normalização silenciosa de tipo e sem usar `peca_cliente` ou `product_id` como prova. Serviço existente pode aumentar quantidade sem virar peça legada. Peça antiga do cliente não ganha débito ao desmarcar a flag.

Analise a transação de corte e reexecução: quais linhas são existentes, como impedir entrada intermediária e como evitar zerar/reclassificar novas baixas numa segunda execução. Não exija reconstrução do passado.

Percorra as seções 11.6/11.7: `managed`, `no_debit`, serviço, cliente, antigo `NULL`, quantidade, troca de produto, catálogo, remoção, cancelamento, arquivar/desarquivar e novo ciclo. Eventos/snapshots não podem sumir por cascata. A tabela e a migração precisam usar o mesmo modelo. A aceitação de D06 não decide D18.

### B. Escritores completos e encerramento de produto

Busque inclusões, atualizações, upserts e exclusões reais, inclusive `estoque/[id].handleDelete`. Julgue se o protocolo de encerramento, referência de saldo e preservação de identidade é suficiente para implementar sem apagar saldo silenciosamente. Procure brechas em clientes antigos, chamadas administrativas, triggers de catálogo e permissões de tabela/coluna.

Confirme que `INSERT/UPDATE/DELETE` direto falha no banco, incluindo saldo zero inicial, e que uma operação antiga não confirma metade de um comando antes do erro. Separe uma OS vazia criada por comando anterior independente de uma venda cujo conjunto precisa ser atômico. Não exigir compensação destrutiva de cadastros já confirmados como outro comando.

### C. Pessoa autenticada versus papel executor

Examine o padrão real de `createClient()` da sessão e `createAdminClient()`. A função `SECURITY DEFINER` muda `current_user`, mas esse valor não identifica o operador. O operador precisa vir de `auth.uid()` não nulo e perfil protegido dentro da função, não de parâmetro preenchido pela rota.

Confira grants efetivos, herança, `PUBLIC`, `anon`, `authenticated`, papel de serviço e auxiliares. Conceder execução por outro papel pode frustrar uma revogação direta. A ausência de `SET ROLE` não prova que o serviço não consegue simplesmente chamar a RPC. Trigger deve executar como invocador e a função proprietária não deve abrir validação por GUC livre.

Prove no desenho por que chamada administrativa é recusada e chamada com JWT do usuário funciona. Examine também proteção de `organization_id/cargo/ativo`, consumidor `app/api/admin/users/route.ts` e relacionamentos de organização. O estado real dos grants permanece uma evidência futura, não uma garantia local.

### D. Fiscal e todos os vínculos

Compare `migration_prevent_duplicate_fiscal_invoice_per_os.sql`, `migration_prevent_duplicate_product_sale_per_os.sql` e `src/lib/work-order-fiscal.ts`. Não confundir prevenção de duplicidade de venda com impedimento geral de arquivamento.

O novo guarda considera documento vinculado de qualquer natureza/tipo/ambiente, inclusive `pending`, remessa/retorno/devolução e estado `error/rejected` incerto. `cancelled` confirmado pode ser histórico conforme a política, sem mandar cancelar documento. Julgue o alcance e os estados no plano sem chamar a Nuvem Local Fiscal.

Confira aprovação por token/local, `reopenOS`, adiantamento, checkout, exclusão e ambos os caminhos de agendamento. Todos os vínculos relevantes precisam compartilhar a trava, inclusive novas inserções. Portal por token não ganha execução nas funções de saldo da sessão humana.

### E. Garantias já estabelecidas e fases

Verifique regressões em: busca por trecho do ID e placa normalizada antes do cursor; contagem com mesmo predicado e erro diferente de zero; replay com resultado confirmado e refresh do estado corrente; versão monotônica; igualdade de organização; soma de `C` uma vez por produto; bloqueio integral de desarquivamento sem saldo.

Confirme que dados de teste permitem ensaio isolado sem declarar aptidão para dados reais. Revisão documental, escolhas do usuário, desenvolvimento autorizado, instalação de guardas, provas de concorrência e habilitação são etapas distintas.

As provas de dados reais continuam dependendo de proteção da afiliação e da configuração instalada. Não exija estoque novo para construir o painel. Não abra lote, reconstrução de ledger, reserva após aprovação, engine 3D, inventário da NHT ou manutenção geral sem relação necessária com os contratos.

## 5. Fontes para iniciar, sem limitar a busca

- `app/(admin)/dashboard/page.tsx`, `app/(admin)/atendimento/page.tsx`, `components/atendimento/ServiceOrderList.tsx` e `app/api/os/create/route.ts`.
- `app/(admin)/os/detalhes/[id]/page.tsx`, `src/actions/os.ts`, `app/(admin)/atendimento/nova-venda/page.tsx`, `app/(admin)/recibo/[id]/page.tsx`.
- `app/(admin)/estoque/novo/page.tsx`, `app/(admin)/estoque/[id]/page.tsx`, `app/(admin)/estoque/importar/page.tsx` e triggers/migrações do catálogo.
- `src/utils/supabase/server.ts`, `src/utils/supabase/admin.ts`, `migration_rls_multi_tenant.sql`, `fix_profiles_rls.sql`, `src/contexts/AuthContext.tsx` e `app/api/admin/users/route.ts`.
- `app/(admin)/agendamentos/page.tsx`, rotas do portal de aprovação/acompanhamento/extrato e `app/acompanhar/PortalClient.tsx`.
- Após ler o contexto fiscal: as duas migrações de duplicidade acima, `src/lib/work-order-fiscal.ts`, `src/actions/fiscal_emission.ts` e `src/actions/fiscal_db.ts`.
- `schema.json`, `schema_types.txt`, `package.json` e demais migrações SQL da raiz. Fotografia local não substitui banco instalado.

A migração de `G:\projetos\otica-gestao` que aparece no IDE pertence a outro projeto e está fora desta auditoria.

## 6. Evidência e entrega

Para cada achado novo ou persistente: ID, prioridade, natureza, bloco afetado, seção/linha do plano, arquivo/linha do código, cenário reproduzível em tese, efeito, confiança e ajuste mínimo. Use P0 para alto impacto de corrupção/acesso, P1 para bloqueio de habilitação segura, P2 para risco relevante e P3 para refinamento. Não invente quantidade de achados nem trate decisão pendente como bug por si só.

O relatório deve conter:

1. Identificação da V4 e parecer por bloco, separando ensaio/desenvolvimento isolado de dados reais.
2. Achados por prioridade com evidência própria.
3. Reavaliação individual de P2-V3-01/02/03/04 e P3-V3-01/02, com resposta documental suficiente/parcial/insuficiente e prova futura. “Corrigido no documento” não significa “corrigido no sistema”.
4. Verificação de que os critérios suficientes da rodada anterior não regrediram.
5. D01–D18: decisões efetivamente registradas, escolhas ainda abertas e garantias técnicas que o usuário não pode dispensar por conveniência.
6. Mudanças mínimas no texto, se necessárias, sem editar o plano, e sem transformar preferência de estilo em nova arquitetura obrigatória.
7. Provas concretas necessárias em banco isolado e no ambiente-alvo antes de habilitar, com implantação/reversão que preserve histórico e não repita estoque.
8. Parecer final por bloco e lista curta das escolhas do usuário realmente necessárias para o próximo passo.

Se os ajustes forem suficientes no nível de plano, diga isso, preservando as condições de validação e negócio. Se faltar mecanismo, indique a lacuna precisa; não termine apenas com “precisa de mais auditoria”. Nenhuma conclusão autoriza implementar, publicar ou migrar dados reais.
