# Auditoria independente — plano V6 do fluxo visual e resposta à correção de peças

**Data:** 09/11/2026.  
**Workspace:** `G:\projetos\autoeletrica`.  
**Natureza:** leitura local e este relatório. Plano, código, migrações, documentos anteriores e dados não foram alterados. Nada foi publicado nem aplicado em banco remoto.

Uma mudança de plano não corrige o sistema. Este parecer não autoriza implementação, migração remota ou publicação.

## 1. Identidade e execução

### 1.1. Hashes lidos

| Arquivo | SHA-256 | Comparação |
| --- | --- | --- |
| `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md` | `E63F49080CCE0BA9ECF9CFADFF789B9559D2212B6298679DBF44BA0095195814` | igual ao esperado para a versão 6 |
| `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V5_AUDITADO.md` | `6A2FD3D4E884F0509FCDB1CBE5C09F2E8759BE1471C227D5DB868B9D779EC0F7` | igual ao hash citado da V5 preservada |
| `docs/AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md` | `15051021B923BC031116E1E3201C2688E10533246503D8FB6DD65F31C119BDA4` | relatório anterior, só leitura |
| `docs/PLANO_RESPOSTA_AUDITORIA_V5_CORRECAO_PECAS.md` | `7288DBBE900128F3E077DC98DAA1C44CFACC436640BAA371C3103FF6A9231038` | proposta; não é código |
| `app/(admin)/os/detalhes/[id]/page.tsx` | `35652740CD02E943AA9B727ED9BBE0AFE3841EE5128C607B194B8D8602813719` | igual ao hash da auditoria V5 |
| `migration_os_part_stock.sql` | `FEFE0D7F0DD87E7F6E5E1487D05069008980DE584A07DA346A0E4367AD3F5A7F` | igual ao hash da auditoria V5 |
| `scripts/test_os_part_stock.cjs` | `F91424E237393673F730FABE58BE53FC5B6813EC64D6BE62592C39DFE229FECD` | igual ao hash da auditoria V5 |
| `docs/CORRECAO_BAIXA_PECAS_OS.md` | `0C80692910F69094EDA47C791478A29AEE99889BBEACBE0F9221EE28BDDC2C65` | igual ao hash da auditoria V5 |

A V6 se declara revisão documental depois da auditoria V5. O código da correção de peças não mudou desde aquele relatório. Git local: `page.tsx` continua modificado no trabalho; plano V6, cópia V5, auditoria V5, plano de resposta, migração e teste continuam não rastreados. Isso não prova o que está instalado no remoto.

Os 69 registros da NHT e a informação de que a maioria das OS é de serviço permanecem declaração do usuário. Não houve contagem.

### 1.2. O que foi executado nesta sessão

| Comando | Resultado |
| --- | --- |
| `node scripts/test_os_part_stock.cjs` | `PASS 15 scenarios; anon/service_role execution denied.` PGlite já presente em `.tmp/os-stock-validation`. Nenhum pacote instalado. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | saída vazia, código de saída 0. |

O script só abre PostgreSQL em memória, com tabelas sintéticas e uma conexão. Relê-lo confirma que não usa credencial nem serviço externo. Os 15 cenários continuam sendo os da correção já auditada. Não provam a idempotência proposta, duas sessões, navegador, RLS instalada nem estado remoto.

Não foi consultado banco remoto, não houve emissão fiscal e não foram lidas credenciais.

### 1.3. Rótulos

| Rótulo | Uso |
| --- | --- |
| Suficiente no texto | o plano V6 ou o plano de resposta cobre o achado o bastante para implementar |
| Parcial | a direção está certa e ainda deixa um mecanismo que pode ser implementado pela metade |
| Insuficiente | o texto não responde o achado |
| Código inalterado | o defeito descrito na V5 continua nos arquivos com os mesmos hashes |
| Decisão pendente | a V6 não trata a opção como aceite |

## 2. Parecer por bloco

### 2.1. Painel

**Apto para desenvolvimento e ensaio isolado.** Não há rota `fluxo-visual` nem status `arquivado` no código de aplicação. Habilitar a tela com dados reais espera a consulta da seção 8, inclusive os quatro estados de interface. Não depende de estoque.

A V6 mantém cinco filas, um carro genérico por OS, cor pela idade desde `created_at`, seleção com foco e retorno, celular e tablet, e a mesma rota para dashboard e Atendimento. O card é “Prévia ilustrativa”, com contador real no predicado `tipo = 'os'`, veículo preenchido, organização e um dos cinco status. A fila `aguardando_peca` pode nascer vazia: o código ainda não grava esse status. O botão da tela de detalhes, linhas 1882–1885 de `page.tsx`, segue de `aprovado` ou `aguardando_peca` para `em_servico`.

A lista atual, `components/atendimento/ServiceOrderList.tsx` linhas 151–163, continua filtrando no navegador. Termo cuja placa normalizada fica vazia casa com todas as placas. A seção 8 da V6 proíbe copiar esse efeito e passa a separar carregamento, vazio confirmado, erro e sessão sem autorização. A linha 331 da seção 19 resume “três estados” e não repete o carregamento; a seção 8 é a que vale.

### 2.2. Lembretes

**A regra de 15 dias contínuos e a ação manual anterior seguem decididas.** Dá para ensaiar o aviso agregado. Cadência de 3 dias, `created_at` como estimativa de OS antiga e a persistência entre abas continuam proposta na seção 20. A V6 não as transforma em aceite. Idade visual e prazo de lembrete continuam relógios diferentes. `updated_at` não serve de relógio de status.

### 2.3. Arquivamento

**A regra de devolver a quantidade atual pode ser ensaiada em banco isolado, já com os caminhos da seção 13 no desenho.** Não está codificada. Habilitar com dados reais continua bloqueado até esses caminhos existirem no banco, não até outro texto. A V6 não reabre prova de baixa, classificação de legado, inventário ou ledger geral.

O ciclo da seção 11 permanece o da decisão do usuário:

- Prévia relê OS e itens no servidor. Serviço não entra na lista de crédito. Item sem `product_id` é preservado e a prévia diz que não há produto a movimentar.
- Peça da loja com produto credita a `quantity` atual. Duas linhas do mesmo produto, 1 e 2, somam 3 antes de um único crédito. Peça do cliente não credita.
- Quantidade fracionada não é truncada. Saldo negativo recebe a soma e não é zerado. Produto inexistente ou de outra organização aborta a operação inteira.
- A transação trava a OS em `orcamento`, estabiliza itens, trava produtos em ordem estável, soma no saldo, grava o evento com o snapshot creditado e muda o status juntos.
- A mesma chave e o mesmo conteúdo devolvem o resultado salvo, mesmo depois de desarquivar, sem abrir outro ciclo. Conteúdo diferente conflita. Chave nova, com a OS já arquivada, não encontra orçamento e não credita de novo.
- Desarquivar e arquivar outra vez é ciclo novo e pode creditar de novo a quantidade que voltou a ficar na OS. O débito do desarquivamento usa o crédito efetivo daquele ciclo, não a tela.

O saldo produzido é o saldo registrado. Não é estoque físico comprovado.

### 2.4. Desarquivamento

**O contrato do snapshot está definido. A falta de saldo segue pendente (D08).** Pode ser ensaiado quando a política de ensaio estiver explícita no teste. Não habilitar com dados reais antes dessa escolha e antes da mesma trava que impede `reopenOS` de apagar comissões e gravar `pronto`.

A V6 não escolhe bloquear, deixar negativo, registrar o restante ou debitar só até zero. A política geral que permite saldo negativo na correção de peças não foi estendida ao desarquivamento.

### 2.5. Correção local já existente

**Inalterada e ainda coerente com 1→2, 2→1 e preço sem movimento.** Os mesmos 15 cenários passaram de novo nesta sessão. É código local, não instalação remota. Os achados P2-B-01, P2-B-02, P2-B-03 e P3-B-01 continuam verdadeiros no código. Publicar esta correção como se a resposta documental já estivesse implementada seria incorreto.

A inclusão segue sem chave de tentativa. O cadastro do produto e a inclusão continuam em transações diferentes, e `handleAdicionarItem` ainda captura o próprio erro. A função continua atômica por dentro e exposta a um `UPDATE` absoluto posterior. A tela ainda oferece edição fora dos cinco status da função.

### 2.6. Resposta futura a essa correção

**Dá para implementar em ensaio a partir do plano de resposta, depois de fechar as lacunas P2-V6-01 e P2-V6-02.** Não está implementada. Não autoriza publicação. A política de saldo negativo é a política já existente, não um aceite novo. A corrida com escritor absoluto continua a decisão aberta da seção 11.3, sem ledger e sem inventário.

## 3. Classificação dos achados V5

Mudança de redação não altera `page.tsx`, a migração nem o banco.

| Achado | Texto V6 ou plano de resposta | Código nesta sessão |
| --- | --- | --- |
| P1-V5-01 | Suficiente | Inalterado; o efeito duplo continua possível se o arquivamento for ligado por cima |
| P2-V5-01 | Suficiente como decisão pendente, não como aceite | Inalterado |
| P2-V5-02 | Suficiente | Inalterado |
| P2-V5-03 | Suficiente | Scripts locais iguais; remoto desconhecido |
| P3-V5-01 | Suficiente | Lista atual inalterada |
| P2-B-01 | Parcial | Inalterado; `useRef` continua sendo a única trava |
| P2-B-02 | Parcial | Inalterado |
| P2-B-03 | Suficiente como ponte para a decisão aberta | Inalterado |
| P3-B-01 | Suficiente como portão de publicação | Inalterado |

### P1-V5-01 — suficiente no texto

A seção 13, linha 230, nomeia remoção de item, alternância de peça do cliente, cancelamento e exclusão na tela da OS, cancelamento pelo recibo, mudanças de status, checkout, aprovação do portal e `reopenOS`. Exige controlar a OS antes de qualquer efeito. Quem movimenta saldo faz item, saldo e estado na mesma transação. A aprovação escreve condicional ao status. `reopenOS` valida o estado antes de apagar comissões. Guarda no banco alcança aba antiga: recusar só a última escrita de status não desfaz crédito já confirmado. O contrato de cada caminho, inclusive cliente administrativo, entra na prova. As linhas 329–330 da seção 19 pedem falha sem efeito parcial.

O código confirma que isso ainda não existe:

- `page.tsx` 762–774, 809–821, 885–904 e 941–963 creditam e só depois apagam item, mudam flag ou status.
- `page.tsx` 703–710 grava status por id. Linhas 1003–1005 gravam `entregue` antes das transações.
- `app/(admin)/recibo/[id]/page.tsx` 115–140 credita e depois grava `cancelado`.
- `app/api/portal/aprovar/route.ts` 26–41 lê `orcamento` e atualiza por id, com cliente administrativo, sem repetir o status no `UPDATE`.
- `src/actions/os.ts` 73–93 apaga comissões pendentes e só então grava `pronto`, também com cliente administrativo, sem ler o status.

Implantação progressiva: a guarda precisa estar no banco antes que `arquivado` possa ser gravado e antes que uma aba antiga ainda possa cancelar ou excluir. Publicar só a tela nova deixa o pacote antigo operando. O cliente administrativo ignora RLS; a trava tem de ser a transação e o predicado de status, não uma política de linha sozinha.

### P2-V5-01 e P2-B-03 — suficientes como risco aberto

A seção 11.3, linhas 206–208, descreve a ficha que leu 5, o arquivamento que somou 2 e a ficha que gravou 5 depois. Não declara o crédito preservado contra todos os escritores. Não transforma a limitação em aceite. A seção 20 cria a decisão ainda não tomada: aceitar o risco por escrito ou implementar proteção que cubra esses escritores. Uma transação só no arquivamento não resolve a corrida. A escolha não muda a regra de devolver a quantidade da OS.

O plano de resposta, linhas 19–21, repete isso para a correção de peças e não afirma consistência global. O `FOR UPDATE` das funções protege a própria transação. Não protege um `UPDATE` absoluto que leu o saldo antes e gravou depois do commit. Aviso de tela também não protege.

Escritores absolutos ainda no código, todos pelo cliente do usuário autenticado, não por ação de servidor em `src/`:

- ficha, `app/(admin)/estoque/[id]/page.tsx` 144–160, grava o número do formulário;
- importação, `app/(admin)/estoque/importar/page.tsx` 531–537, grava saldo lido mais quantidade da nota;
- venda de balcão, `app/(admin)/atendimento/nova-venda/page.tsx` 388–399;
- remoção, cancelamento, exclusão, alternância e recibo, já citados.

Não há `estoque_atual` em `src/`. Portal, extrato e `reopenOS` usam cliente administrativo para status, leitura ou comissão, não para esta coluna. `service_role` hoje não é um escritor de saldo. Continua sendo escritor de status, e um papel que ignora RLS se algum caminho futuro gravar a coluna por ele.

Alcance real das alternativas, sem reconstruir histórico:

| Alternativa | Cliente antigo e escrita direta | `service_role` | O que não faz |
| --- | --- | --- | --- |
| Versão conferida só na tela nova | Não impede. O `UPDATE` antigo não envia a versão e grava 5. | Não impede, se esse papel gravar a coluna sem a versão. | Não precisa de inventário. Também não segura a corrida. |
| Delta só nas funções novas | Não impede. O cliente antigo continua mandando o valor absoluto. | Não impede uma escrita absoluta desse papel. | Não reescreve baixas passadas. |
| Recusa no banco: gatilho ou restrição que rejeita mudança de `estoque_atual` fora da operação autorizada, ou exige versão incrementada na própria linha | Impede o `UPDATE` do pacote antigo, da importação, da venda e da ficha. | Impede também, porque gatilho de tabela dispara mesmo com bypass de RLS. Superusuário que desliga gatilho fica de fora do aplicativo. | Quebra as telas atuais até elas passarem pela operação permitida. Não cria ledger nem mexe em saldo histórico na instalação. |
| Trava de linha só durante o arquivamento, RPC atômica ou aviso no navegador | Não impede a gravação posterior. | Não impede. | A V6 já diz isso. |

A decisão pendente é exatamente essa: aceitar que a gravação 5 apague o crédito 7, ou adotar recusa/versão obrigatória no banco, com alcance de todos os papéis que atualizam a coluna. As duas opções preservam a devolução pela quantidade da OS. Nenhuma está aceita.

### P2-V5-02 — suficiente no texto

A seção 17, linha 291, manda, no mesmo lançamento que introduzir `arquivado`, tirar esse status do total operacional do extrato e das previsões de entrega, mantendo a consulta histórica. A seção 19, linha 330, repete o critério.

O código segue como na V5. `app/api/portal/extrato/route.ts` linhas 66–74 somam toda OS do cliente que não está `cancelado`, via cliente administrativo. `app/(admin)/dashboard/page.tsx` linhas 122–135 listam previsão excluindo só `entregue` e `cancelado`. Um orçamento arquivado com valor e data ainda entraria nas duas contas.

Bloquear adiantamento, obrigação, documento ou compromisso continua proposta da seção 14, não decisão. Se alguma dessas regras for adotada, a verificação e a mudança de status precisam da mesma trava da OS; uma leitura anterior não impede o vínculo inserido no meio. A V6 não escolhe a política pelo usuário e não manda estornar ou cancelar vínculo.

Fiscal, depois do contexto da Nuvem Local Fiscal: arquivar não emite, não cancela e não troca provedor. Os gatilhos locais de duplicidade não são guarda de arquivamento. A função substituída em `migration_prevent_duplicate_product_sale_per_os.sql` linhas 37–47 aceita como ativos `draft`, `pending`, `processing` e `authorized`, e devolve cedo natureza especial de NF-e. `error` e `rejected` ficam de fora. `src/lib/work-order-fiscal.ts` linhas 10–25 usam a mesma ideia de status ativo. A proposta da seção 14, se for adotada, pede também estado incerto, todos os tipos, naturezas e ambientes. A função instalada no remoto não foi confirmada.

### P2-V5-03 — suficiente no texto

As seções 15 e 17 condicionam o uso de cargo e afiliação à proteção efetiva, e registram que o SQL local não comprova essa proteção nem o estado remoto. D04 segue proposta. A consulta do painel pode seguir o acesso atual às OS.

Os scripts locais continuam com `profiles_update_own` por `id = auth.uid()` sem lista de colunas, em `migration_rls_multi_tenant.sql` linhas 120–121 e `fix_profiles_rls.sql` linhas 41–42. `get_my_organization_id()` é `SECURITY DEFINER`. Isso é fato dos arquivos. Não é diagnóstico do banco publicado. Não dá para declarar o remoto vulnerável nem seguro.

### P3-V5-01 — suficiente no texto

A seção 8 exige busca, filtro e contagem no servidor, antes da paginação, com o mesmo predicado. O termo encontra trecho do identificador, cliente, modelo e placa normalizada não vazia. Carregamento, vazio confirmado, erro e falta de autorização são estados diferentes. A lista atual não é modelo pronto: a frase “conforme a lista existente” descreve os campos, e a frase seguinte proíbe o casamento universal da placa vazia.

### P2-B-01 — parcial

O plano de resposta, linhas 5–11, acerta o contrato visível: chave antes da chamada; mesma organização, ator, OS e conteúdo canônico devolvem o mesmo item, sem novo débito; conteúdo diferente na mesma chave não tem efeito; duas chaves intencionais podem incluir o mesmo produto; a chave sobrevive à resposta incerta e à recarga; não basta `useRef`; incerteza não dispara outra inclusão em silêncio; repetição depois de outro status devolve o histórico e a interface lê o estado atual.

O código não tem nada disso. `page.tsx` linhas 1270–1271 e 1334–1336 continuam com trava de memória e, no erro, não recarregam a OS. A migração insere um item a cada chamada. O teste de edição com snapshot velho não é replay de sucesso da inclusão.

Faltam três mecanismos para o teste que o próprio plano pede. Estão no achado P2-V6-01.

### P2-B-02 — parcial

O plano de resposta, linhas 13–17, acerta a mensagem quando o cadastro foi confirmado e a inclusão falhou de modo comprovado, a trava do botão antes do primeiro `INSERT`, a proibição de criar outro produto automaticamente e a separação entre falha comprovada e resposta incerta. Manter saldo negativo, inclusive no produto novo com saldo zero, é a política já codificada, não uma decisão nova. Transação única de cadastro mais inclusão fica como alternativa.

O texto não nomeia o scanner, a base global nem o cadastro rápido, que são os outros `INSERT` de produto com saldo zero na mesma tela. E o helper atual engole o erro, então o chamador não consegue aplicar a distinção. Está no achado P2-V6-02.

### P3-B-01 — suficiente como portão

O plano de resposta manda conferir, antes de publicar, os estados efetivos do destino, sem investigar saldo antigo; explicar na interface o estado bloqueado; alargar a lista só para estado cujo tratamento foi validado. A verificação remota não foi feita e não deve ser inferida.

Conferência local, sem contar linhas: a função, `migration_os_part_stock.sql` linhas 36–37 e 114–115, recusa status nulo e qualquer status fora dos cinco. A tela esconde editar, remover e adicionar só em `cancelado` e `entregue` (`page.tsx` 2284, 2331 e 2363). `migration_add_wo_tipo.sql` linha 20 cita `em_andamento`; o código atual não grava esse status. Se uma OS nula ou `em_andamento` existir no destino, a tela mostra os botões e a função recusa a inclusão e a edição sem movimento. Remover ainda usa o caminho antigo. A presença dessas linhas é desconhecida.

## 4. Achados novos

### P2-V6-01 — A idempotência da inclusão ainda não tem unicidade, escopo do ator nem retenção que preserve o resultado

- **Natureza:** lacuna do plano de resposta. O código atual continua sem idempotência. Risco futuro se for implementado só com consulta anterior ao `INSERT`.
- **Bloco:** resposta futura à correção de peças.
- **Referência:** `docs/PLANO_RESPOSTA_AUDITORIA_V5_CORRECAO_PECAS.md` linhas 5–11. Código: `migration_os_part_stock.sql` linhas 51–63; `page.tsx` linhas 1270–1271.
- **Cenário:** duas sessões enviam a mesma chave ao mesmo tempo. As duas não encontram resultado e as duas inserem. Outro caso: a chave de um usuário é reenviada por outro ator da mesma oficina; devolver o item alheio revela a operação, e tratá-la como chave nova debita de novo. Terceiro caso: a linha da tentativa é apagada pelo prazo e o celular repete a chave; nasce outra peça.
- **Efeito:** o teste de chamadas simultâneas pedido pelo plano falha sem restrição única. A frase “mesma organização, ator, OS e conteúdo” não diz o que acontece quando a chave já existe e o ator ou a OS divergem.
- **Confiança:** alta na leitura do plano e do código; a corrida de duas sessões não foi executada.
- **Solução mínima:** gravar a tentativa na mesma transação da inclusão, com unicidade da chave. Chave já existente com ator, organização, OS ou conteúdo diferentes rejeita sem efeito e sem devolver o payload da outra tentativa. A linha permanece enquanto a OS puder receber nova inclusão por repetição, ou a repetição de chave expirada também rejeita sem debitar. Se a chave local sumir, recarregar os itens da OS antes de emitir outra chave. Conteúdo canônico com escala numérica estável para quantidade e preço.
- **Prova:** o teste já descrito no plano, mais ator divergente, chave expirada e perda da chave local. Duas conexões de verdade, não duas chamadas na mesma sessão.

### P2-V6-02 — O chamador não vê a falha da inclusão, e scanner e catálogo global ficaram fora do texto

- **Natureza:** lacuna do plano de resposta diante de código atual. Erro de fluxo já presente na tela.
- **Bloco:** resposta futura à correção de peças.
- **Referência:** plano de resposta linhas 13–17. `page.tsx` 1334–1336 captura o erro de `handleAdicionarItem` e não o relança. Cadastro e inclusão: 1370–1395. Scanner: 1541–1569. Base global: 1455–1478. Cadastro rápido: 1608–1658, cria saldo zero e não adiciona à OS.
- **Cenário:** “Cadastrar e adicionar” grava o produto. A inclusão falha de forma comprovada. O alerta interno diz “Erro ao adicionar item” e a função externa segue como se não houvesse exceção. A mensagem “Produto cadastrado; a peça não foi adicionada à OS” não tem de onde sair. O mesmo silêncio vale para o scanner e para a importação da base global. Um segundo clique no cadastro rápido, antes de qualquer trava, pode criar outro produto com saldo zero.
- **Efeito:** não há baixa parcial. O estado mostrado não é o estado comprovado. Tratar só o botão “Cadastrar e adicionar” deixa os outros dois caminhos que também chamam a inclusão depois do `INSERT`.
- **Confiança:** alta. Os hashes são os da V5, e essas linhas foram relidas.
- **Solução mínima:** a inclusão devolve sucesso, falha comprovada ou resultado incerto, em vez de engolir o erro. Aplicar a trava antes do `INSERT` e a mensagem de produto já criado ao cadastro, ao scanner e à base global. No cadastro rápido, a trava evita o segundo produto; a mensagem é de cadastro sem item, porque esse fluxo não tenta a inclusão. Se a reconciliação da chave falhar, não afirmar que a peça entrou nem criar outro produto.
- **Prova:** cadastro confirmado com erro comprovado da inclusão; resposta perdida; segundo clique durante o `INSERT`; os três caminhos de criação. Sem rede externa no teste do scanner: basta simular o `INSERT` local e a falha da função.

## 5. Regressões de escopo

A V6 não marca como aceitos a cadência, a data estimada, os cargos, o desarquivamento sem saldo, os vínculos impeditivos, o alcance de bancada, as faixas visuais, a exclusão de arquivada ou o comando de `aguardando_peca`. A seção 20 continua lista de propostas. A decisão nova da linha 354 é a escolha ainda aberta do P2-V5-01, não um aceite do risco.

Não voltou `known` / `legacy_unknown`. Não voltou a exigência de prova de baixa. Não voltou ledger nem inventário como requisito. A frase da linha 352, sobre resolver transação e concorrência na implementação, não adia a seção 13: o texto da linha 230 continua condição para dados reais.

A correção de peças não foi alterada para parecer que os achados B já foram corrigidos. A seção 22 da V6 diz isso com clareza.

## 6. Decisões, riscos e implantação

### Ainda é preciso escolher

- D02/D05: cadência e data estimada de orçamento antigo.
- D04: quem arquiva, só depois da proteção de perfil.
- D08: falta de saldo ao desarquivar.
- D09/D10: impedir arquivamento por adiantamento, obrigação, documento ou agenda.
- D11: bancada, separada dos carros.
- D03/D12/D13/D15: faixas, ordem, página e detalhes visuais.
- D16: bloquear exclusão e cancelamento da arquivada, ou outra forma que não credite de novo.
- D17: comando de `aguardando_peca` ou fila só de leitura.
- P2-V5-01: aceitar por escrito a sobrescrita por saldo absoluto, ou proteção no banco que alcance esses escritores.

### Risco sem aceite

A ficha, a importação, a venda e os caminhos antigos da OS podem gravar um saldo absoluto depois do crédito. A V6 deixa isso em aberto de propósito. Não é garantia da RPC, da trava de uma linha nem de um aviso.

### O que pode ser desenvolvido em ensaio

Painel com o predicado e a busca da seção 8. Lembrete de 15 dias com ação manual, sem tratar cadência e data antiga como fechadas. Arquivamento isolado com a soma da quantidade atual, evento, status e os caminhos da seção 13 na mesma família de transação. Idempotência da inclusão e mensagens de cadastro, depois de P2-V6-01 e P2-V6-02.

### O que impede habilitação com dados reais

Arquivamento: implementar P1-V5-01 e P2-V5-02, e fechar P2-V5-01 por aceite explícito ou por proteção real. Correção de peças: a migração auditada continua não aplicada; antes de publicar, verificar se ela já existe no destino e escolher entre ajustar o arquivo preparado ou acrescentar migração seguinte. A tela nova sem a função falha a inclusão e a edição. A função sem a tela nova não muda o JavaScript antigo, que ainda cadastra peça sem baixar nesse botão. Não remover a função enquanto a tela nova estiver no ar. Abas antigas continuam gravando saldo absoluto até a guarda correspondente existir.

Ordem da correção, quando os planos de resposta forem código: migração da função e da tentativa antes do cliente que envia a chave. Teste de duas sessões antes de propor publicação. Os 15 cenários atuais não substituem esse teste.

Não há motivo neste parecer para outra auditoria só por preferência de texto. Há motivo para não tratar a V6 como sistema corrigido e para não publicar o arquivamento sobre os caminhos atuais de remoção, cancelamento, exclusão, alternância, recibo, checkout, portal e `reopenOS`.
