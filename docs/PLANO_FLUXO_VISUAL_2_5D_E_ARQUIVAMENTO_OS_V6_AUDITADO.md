# Plano de implementação: fluxo visual 2,5D e arquivamento de OS

**Data-base:** 09/11/2026.  
**Projeto:** `G:\projetos\autoeletrica`.  
**Versão:** 6, revisão documental após a auditoria V5.  
**Estado:** plano atualizado; o arquivamento e o painel visual ainda não foram implementados. A correção pontual de inclusão/edição de peças está preparada localmente, em entrega separada. Nenhum banco remoto foi consultado ou alterado nesta revisão.

Esta versão mantém a regra simplificada de estoque definida pelo usuário e responde à [auditoria V5](AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md). A [versão 5 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V5_AUDITADO.md) foi preservada com SHA-256 `6A2FD3D4E884F0509FCDB1CBE5C09F2E8759BE1471C227D5DB868B9D779EC0F7`. Respostas documentais não são correções implementadas nem confirmação de estruturas instaladas.

## 1. Regra de negócio definida pelo usuário

> OS antiga que for arquivada, devolve a peça pro estoque.

Aplicação da regra:

- Arquivar uma OS em orçamento devolve a quantidade atual das peças da loja vinculadas a produtos de estoque.
- A regra vale também para OS já existentes, independentemente de haver prova da baixa anterior.
- Serviços não movimentam estoque. Peças fornecidas pelo cliente também não.
- Uma OS composta apenas por serviços pode ser arquivada sem movimentar produtos.
- Não fazer levantamento, inventário, reconstrução de baixas, ajuste em massa ou saneamento dos saldos da NHT ou das demais oficinas como parte desta entrega.
- Não criar um controle geral de movimentos de estoque nem exigir que todos os fluxos de estoque sejam refeitos para entregar o arquivamento.

Esta é uma política operacional baseada na quantidade registrada na OS, e não uma conclusão de que todas as baixas passadas ocorreram corretamente. O arquivamento executará essa devolução; não tentará corrigir diferenças anteriores por outros cálculos.

O usuário informou que a maioria das OS abertas é de serviço, e que oficinas como a Kabroski compram peças conforme a necessidade do conserto. Não presumir que toda oficina controle seu estoque físico. Não usar essa informação como se fosse uma contagem feita no banco.

## 2. Escopo e decisões já definidas

| Tema | Regra |
| --- | --- |
| Finalidade visual | Representar o fluxo das OS, inclusive veículos que estejam com o cliente. Não representar box, vaga ou presença física. |
| Aparência | Carro genérico reutilizado, com acabamento intermediário em 2,5D; sem reproduzir o modelo ou a cor real. |
| Filas | Orçamento, Aprovado, Aguardando peça, Em serviço e Pronto. |
| Cor dos carros | Tempo total desde a abertura da OS. |
| Seleção | Carro ampliado, demais carros atenuados/desfocados e mais espaço para informações. |
| Acessos | Dashboard e Atendimento abrem a mesma tela. |
| Card no dashboard | Recorte de ilustração pré-renderizada, com alguns carros e contador real separado. |
| Novo status | `arquivado`, sem fila e sem carro no painel. Não criar `recusado`. |
| Ação | Arquivamento manual de uma OS em `orcamento`; não arquivar automaticamente pelo tempo. |
| Prazo | Sugerir após 15 dias contínuos em orçamento. Permitir ação manual antes dos 15 dias. |
| Envio de orçamento | Não é requisito; a negociação pode ter ocorrido pessoalmente. |
| Histórico | Preservar OS, itens e eventos; disponibilizar consulta de arquivadas e desarquivamento. |
| Peças ao arquivar | Devolver `quantity` das peças da loja vinculadas a produtos, uma vez por ciclo. Não exigir comprovação de baixa anterior. |
| Edição de quantidade | Na mesma linha: 1 relê para 2 compromete mais 1; 2 para 1 libera 1. Não exigir outra linha para o acréscimo. |

As propostas ainda não decididas estão na seção 20. A simplificação de estoque não aprova automaticamente propostas de cargos, obrigações ou desarquivamento.

## 3. Base local e limites conhecidos

O projeto usa Next.js, React, Tailwind e Supabase. A implementação visual não precisa de uma engine 3D.

| Evidência local | Aplicação neste plano |
| --- | --- |
| A lista de Atendimento já usa os cinco status operacionais. | Reutilizar os status; centralizar rótulos e filtros. |
| Não foi encontrado comando de tela que grave `aguardando_peca`. | A fila pode ficar vazia até existir uma ação explícita; não inferir status pela quantidade de estoque. |
| A lista separa OS de vendas e usa vínculo de veículo. | O painel representa apenas OS com veículo, conforme a seção 4. |
| A inclusão e a edição de peças receberam uma correção local separada. | Conferir [Correção da baixa de peças na OS](CORRECAO_BAIXA_PECAS_OS.md) e a migração pendente antes de publicar essa correção. |
| Remover, cancelar, alternar peça do cliente e excluir OS possuem caminhos próprios. | Impedir que esses caminhos devolvam estoque novamente em uma OS arquivada. A proteção deve ocorrer antes de qualquer efeito parcial. |
| `reopenOS` escreve `pronto` e não é uma operação de desarquivar orçamento. | Não reutilizá-la; rejeitar seu uso sobre arquivadas. |
| A aprovação do portal lê orçamento e depois escreve em outra chamada. | Tornar a escrita condicional ao status atual para tratar aprovação concorrente com arquivamento. |
| Dashboard e extrato do portal possuem consultas que excluem apenas alguns status finais. | Retirar arquivadas dos totais e pendências operacionais corretos, preservando consultas históricas. |
| Adiantamentos e compromissos podem existir enquanto a OS está em orçamento. | Tratar os vínculos conforme a política da seção 14, sem apagá-los ou estorná-los automaticamente. |
| O SQL local não prova proteção efetiva de cargo/organização/ativo do perfil. | Conferir as permissões instaladas necessárias aos novos acessos; não confiar apenas no navegador. |
| O vínculo de produto não compõe organização na FK local. | Conferir explicitamente que OS, item, produto e evento pertencem à mesma organização. |

`schema.json` é uma fotografia antiga e não contém todos os campos já usados pela aplicação. A implementação exige conferir compatibilidade de esquema e permissões; essa conferência técnica não será um inventário de estoque ou uma reconstrução do passado.

Os 69 registros abertos da NHT foram informados pelo usuário e não foram contados nesta análise. Não condicionar a entrega a confirmar esse número.

## 4. Tela, filas e representação

Rota proposta: `/atendimento/fluxo-visual`. Dashboard e Atendimento navegam para essa rota, sem manter duas versões do painel.

Cada carro representa uma OS, identificada pelo seu número. Duas OS da mesma placa aparecem separadamente.

Predicado do painel: organização autenticada, `work_orders.tipo = 'os'`, `vehicle_id IS NOT NULL` e status em uma das cinco filas.

| Ordem | Status | Rótulo |
| --- | --- | --- |
| 1 | `orcamento` | Orçamento — Aguardando aprovação |
| 2 | `aprovado` | Aprovado |
| 3 | `aguardando_peca` | Aguardando peça |
| 4 | `em_servico` | Em serviço |
| 5 | `pronto` | Pronto |

Manter todas as filas visíveis quando vazias, com mensagem de vazio e sem carros fictícios.

Excluir do desenho arquivadas, entregues, canceladas, vendas de balcão, bancada e OS sem veículo. Não presumir que um tipo nulo ou desconhecido seja `os`; manter esses registros consultáveis pela lista.

A representação com carros e o alcance do arquivamento são assuntos distintos: uma eventual ampliação do arquivamento para bancada não cria carros artificiais.

## 5. Aparência, seleção e dispositivos

Usar imagens transparentes de um mesmo carro genérico em ângulo fixo, com variação de cor por idade. A seleção amplia o mesmo ativo, sem trocar seu desenho nem renderizar modelos reais.

No tablet, distribuir os carros em cinco filas horizontais empilhadas, com perspectiva discreta, sombras leves e profundidade por composição. Não usar cenário detalhado de oficina ou posições físicas obrigatórias.

No celular, manter as cinco filas empilhadas com rolagem horizontal independente. Deixar parte do próximo carro visível quando houver mais itens. Não depender de gesto de passar o mouse.

Ao selecionar, ampliar o carro, atenuar/desfocar o restante e abrir o resumo. No tablet, usar painel lateral ou sobreposição ampla; no celular, painel inferior ou tela de detalhe com espaço para leitura.

Resumo: número da OS, cliente, placa/modelo, status, idade, descrição principal, previsão quando existente e ações permitidas. Exibir valores somente com a mesma permissão da lista atual.

Oferecer acesso a detalhes e arquivamento quando elegível. Fechar por botão e Escape no teclado; devolver foco ao carro selecionado. Respeitar redução de movimento, contraste, alvos de toque e indicação de idade em texto além da cor.

Os [estudos visuais](referencias-fluxo-visual/02-estudo-filas-tablet.png) são referências conceituais. Algumas imagens têm quatro filas; a implementação terá as cinco definidas. Não tratar essas imagens como ativos finais de produção.

## 6. Dois relógios

**Idade visual:** tempo desde `created_at`. Não reiniciar ao mudar status ou desarquivar. Rótulo: “Tempo da OS” ou “Dias desde a abertura”.

Faixas propostas, ainda não aprovadas: menos de 3 dias verde; 3 a menos de 7 amarelo; 7 a menos de 14 laranja; 14 ou mais vermelho. Datas inválidas ou futuras recebem indicação neutra, sem idade negativa.

**Lembrete:** 15 dias desde a entrada mais recente em `orcamento`. Editar descrição, preço ou quantidade não reinicia o prazo. Registrar o instante real das novas transições no banco; `updated_at` não serve como relógio de status.

Ao desarquivar, voltar a orçamento e iniciar um novo período para o lembrete. Para orçamentos já existentes sem histórico de entrada, a proposta é usar `created_at` como estimativa identificada. Essa referência ainda precisa de decisão; não fingir que a estimativa é uma transição histórica comprovada.

Usar relógio do servidor e apresentar datas em `America/Sao_Paulo`.

## 7. Card do dashboard

Composição estática que parece uma janela recortando uma cena maior de filas e carros. Marcar como “Prévia ilustrativa”. Exibir separadamente um contador real de “OS ativas com veículo”, com o mesmo predicado do painel.

O card abre a tela completa por toda sua área acessível. Não carregar todas as OS nem uma engine gráfica para mostrar a miniatura. Reservar dimensões da imagem e usar recorte responsivo.

Em carregamento ou erro, não mostrar zero como se fosse uma contagem confirmada.

## 8. Consulta e busca

Fazer busca, filtros e contagem no servidor, antes da paginação. Aplicar a mesma organização e predicado à contagem e aos resultados.

Na página de filas, distinguir carregamento, lista vazia confirmada, erro de consulta e sessão sem autorização. Não apresentar falha como ausência de OS (P3-V5-01).

A busca deve encontrar trecho literal do identificador, nome do cliente, modelo e placa normalizada, conforme a lista existente. Preservar o identificador completo como chave; o número abreviado exibido também deve ser encontrável. Não permitir que um termo cuja placa normalizada ficou vazia corresponda a todas as placas.

Ordenação proposta: mais antigas primeiro, com desempate por ID. Página inicial proposta: 20 por fila, com carregamento de mais itens. Não carregar todas as OS e filtrar apenas no navegador.

Ao voltar da tela ou dos detalhes, preservar busca, fila e rolagem quando possível. Validar rotas internas de retorno.

## 9. Lembretes

Mostrar aviso agregado com contador e botão de revisão: “Há orçamentos antigos para revisar”. Não mostrar uma notificação por OS.

O candidato deve estar em orçamento, na organização da sessão e ter completado os 15 dias. O recorte inicial acompanha as OS com veículo; o alcance para bancada ainda está proposto.

A ação manual nos detalhes independe do prazo. O lojista pode arquivar antes dos 15 dias, desde que os demais requisitos da operação sejam cumpridos.

Cadência proposta: a cada 3 dias por usuário e organização, enquanto existirem candidatos. Isso corresponde a duas ou três oportunidades semanais para quem usa o sistema regularmente. Não garantir apresentação se o usuário não acessar o aplicativo.

Persistir próxima oportunidade no servidor para evitar repetição entre celular, tablet e abas. Ao manter um orçamento, adiar o aviso sem reiniciar sua idade. Dashboard e Atendimento não devem apresentar o mesmo aviso duas vezes na mesma oportunidade.

Não incluir arquivamento em lote, cron, WhatsApp, e-mail ou notificação do navegador nesta primeira entrega.

## 10. Experiência de arquivar e consultar

Transição inicial: `orcamento -> arquivado`, por ação humana.

Mostrar uma confirmação curta com identificação da OS e lista das peças/quantidades que serão devolvidas. Serviços não entram nessa lista. Mostrar explicitamente itens sem vínculo de produto que não possuem saldo a movimentar. Não exigir justificativa extensa; motivo proposto “Orçamento antigo”, com observação opcional.

Na confirmação, o servidor lê novamente estado e itens; não aceita quantidade ou organização enviadas pelo navegador como verdade. Se a composição mudou desde a prévia, pedir atualização antes de confirmar.

Depois de confirmado, retirar dos carros e dos contadores operacionais adequados. Manter OS, cliente, veículo, valores, itens, fotos e histórico. Não zerar o orçamento nem marcar como entregue ou recusado.

Na consulta de arquivada, mostrar faixa de estado, instante e responsável. Manter filtro “Arquivadas”. Bloquear edição de itens, aprovação, execução, entrega e devoluções adicionais enquanto estiver arquivada.

## 11. Devolução de peças na operação de arquivar

### 11.1. Seleção e cálculo

Ler os itens atuais da própria OS no banco. Um item movimenta produto se `tipo = 'peca'`, não está marcado como `peca_cliente` e possui `product_id`.

Para cada item elegível, devolver sua `quantity` atual. Agrupar pelo produto antes de alterar saldo; registrar no evento as linhas e quantidades que compuseram a soma.

Exemplo: uma OS tem 2 relês do mesmo produto e 1 serviço. Arquivar soma 2 ao saldo do produto. O serviço não gera saldo. Se duas linhas do mesmo produto têm 1 e 2 unidades, o crédito total é 3.

A mesma regra vale para uma OS antiga e uma nova. Não adicionar classificação `known`/`legacy_unknown`, não exigir prova de débito, não criar uma revisão manual de quantidade antiga e não separar acréscimos em outra linha.

Peça do cliente não altera saldo. Item sem `product_id` não gera cadastro ou estoque artificial: arquivar preserva o item comercial e informa que não há produto vinculado a movimentar. Se um `product_id` informado aponta para produto inexistente ou de outra organização, rejeitar a operação inteira para evitar crédito errado. Quantidade inválida de peça a devolver também impede a operação, com identificação do item.

Não mudar saldos de outros produtos nem fazer inventário. Um saldo já negativo recebe a mesma soma aritmética; não zerar nem corrigir o valor por outra regra.

### 11.2. Transação e repetição

Executar no banco, em uma transação:

1. Identificar o usuário autenticado, conferir perfil ativo, organização e permissão.
2. Reconhecer uma repetição da mesma operação já confirmada. Mesma chave e mesmo conteúdo retornam o resultado salvo; conteúdo diferente conflita.
3. Bloquear a OS e verificar que continua em `orcamento`.
4. Estabilizar seus itens e comparar com a prévia. Mutação concorrente de itens/status deve usar o mesmo controle da OS.
5. Conferir os vínculos impeditivos definidos para o arquivamento.
6. Validar organizações e quantidades; bloquear os produtos em ordem determinística.
7. Aplicar `estoque_atual = coalesce(estoque_atual, 0) + quantidade_devolvida`, sem usar saldo calculado no navegador.
8. Gravar o evento do ciclo com autor, instante, itens e quantidades creditadas; mudar o status para `arquivado`.
9. Confirmar tudo junto. Qualquer falha desfaz crédito, evento e status.

O evento registra a devolução feita agora, não uma baixa passada presumida. Não criar um ledger geral de estoque como pré-requisito.

Além da chave de operação, a transição de estado protege contra dois cliques com chaves distintas: depois que uma operação arquivou, a segunda não encontra orçamento elegível e não credita novamente.

Uma chave antiga repetida depois de desarquivar retorna o resultado histórico, sem arquivar novamente. A interface consulta o estado corrente para atualizar a fila.

### 11.3. Limite desta correção

Outros caminhos de venda, entrada, importação e ajuste manual de produtos não serão reestruturados nesta entrega. A escrita aritmética do arquivamento elimina o cálculo de seu saldo no navegador, mas não comprova consistência global contra todos os clientes antigos que ainda gravam valores absolutos.

**P2-V5-01 — risco ainda aberto:** uma ficha que leu saldo 5 pode gravar 5 depois que o arquivamento somou 2, apagando o crédito registrado no evento. O saldo físico já incorreto e essa perda concorrente são questões distintas. Não declarar que o crédito permanecerá preservado perante todos os escritores atuais. A V5 reconheceu a limitação; esta revisão não a transforma em aceite expresso do usuário. Antes de habilitar com dados reais, apresentar a alternativa de proteção proporcional e seus impactos ou registrar explicitamente a aceitação desse risco. Nenhuma opção exige inventário ou ledger histórico. A proteção eficaz precisa alcançar todos os escritores capazes de sobrescrever saldo; verificar alternativas de versão/delta/recusa também contra clientes antigos e escritas administrativas, sem presumir que uma mudança apenas de interface seja suficiente.

As proteções necessárias à própria OS arquivada continuam no escopo da seção 13. Não transformar essa proteção em projeto de reorganização de todo o estoque.

## 12. Desarquivar

Usar operação específica `arquivado -> orcamento`; não usar `reopenOS`, cujo destino é `pronto`.

Ler o evento do último arquivamento válido e reaplicar como débito exatamente as quantidades que ele devolveu. Não recalcular pela quantidade de uma tela, não debitar serviços/peças do cliente e não inventar débito para item que não gerou devolução.

Confirmar status, evento e saldo na mesma transação, com proteção contra repetição. Registrar o fechamento do ciclo e o retorno ao orçamento. Novo arquivamento posterior constitui outro ciclo; pode devolver novamente a quantidade que voltou a ficar comprometida com essa OS.

A política caso falte saldo ao desarquivar ainda não foi escolhida. A recomendação anterior de bloquear toda a reativação permanece proposta; não presumir aprovação, nem alterar silenciosamente a política geral que hoje permite estoque negativo.

## 13. Caminhos alternativos e proteção do estado

Não basta esconder botões. As gravações de status e itens precisam respeitar `arquivado` também no backend/banco, inclusive para abas antigas.

Uma OS arquivada não pode ser removida/cancelada por um caminho que devolva novamente `item.quantity`. A proposta para esta entrega é bloquear exclusão permanente e cancelamento enquanto arquivada; histórico fica acessível.

Proteger `reopenOS` contra arquivadas. A operação não pode apagar comissões ou escrever `pronto` antes de verificar o status permitido.

Ao ajustar remover item, cancelar, alternar peça do cliente ou editar quantidade para respeitar esse estado, a validação e os efeitos da mesma OS devem acontecer na mesma transação. Rejeitar o status somente depois de uma devolução por outra chamada não é suficiente.

**P1-V5-01 — cobertura obrigatória antes de dados reais:** inventariar e adaptar a remoção de item, alternância de peça do cliente, cancelamento e exclusão na tela da OS, cancelamento pelo recibo, mudanças de status e checkout, aprovação pelo portal e `reopenOS`. Cada caminho que possa disputar o arquivamento controla a mesma OS primeiro e verifica o estado de origem antes de qualquer efeito; os que movimentam saldo fazem item, saldo e estado aplicáveis na mesma transação. A aprovação deve fazer a escrita condicional ao status; `reopenOS` valida o estado antes de apagar comissões. Guardas no banco devem impedir também as chamadas das abas antigas de deixar efeitos parciais: não basta bloquear a última escrita de status quando um crédito anterior já foi confirmado. Validar o contrato individual de cada caminho, inclusive os que usam cliente administrativo.

A aprovação local/pública deve exigir `orcamento` na escrita efetiva. Se a aprovação vencer a corrida, arquivar falha sem crédito. Se arquivar vencer, a aprovação falha e o portal orienta contato com a oficina.

Não permitir alterar diretamente o status para entrar/sair de arquivado sem executar a operação correspondente, por função controlada ou mecanismo equivalente no banco. A proteção cobre os caminhos administrativos pertinentes à OS, sem liberar bypass por um argumento enviado pelo cliente.

## 14. Vínculos financeiros, fiscais e agenda

Estas são propostas de impedimento, ainda não aprovadas expressamente: bloquear arquivamento com recebimento/adiantamento, obrigação financeira pendente, documento ativo ou incerto e compromisso ativo vinculado. Mostrar qual pendência exige tratamento no fluxo próprio.

A conferência fiscal deve respeitar o [contexto obrigatório da Nuvem Local Fiscal](../CONTEXTO_NUVEM_LOCAL_FISCAL.md). Não trocar provedor, emitir, cancelar ou apagar documentos como efeito do arquivamento.

Se adotado o bloqueio fiscal proposto, incluir `draft`, `pending`, `processing` e `authorized`, todos os tipos, naturezas e ambientes vinculados. Não presumir que `error` ou `rejected` provem encerramento; estados incertos exigem tratamento adequado. Histórico comprovadamente cancelado pode permanecer apenas como histórico, conforme política escolhida.

Não reutilizar como guarda de arquivamento os gatilhos locais de evitar duplicidade fiscal: eles têm escopo mais estreito. A função instalada ainda não foi confirmada.

Agenda: proposta de impedimento em `agendado`, `confirmado` e `em_atendimento`. Não cancelar compromissos automaticamente. `ja_tem_os` é tipo, não status.

Qualquer vínculo considerado impeditivo precisa respeitar a transação da OS para não surgir entre a verificação e o arquivamento. A implementação desses controles é distinta de auditar o estoque físico.

## 15. Autorização

Consulta segue o acesso às OS da organização. Proposta de mutação: dono (`owner`), administrador (`admin`) e gerente (`gerente`), com perfil ativo.

Derivar usuário da sessão autenticada. Validar no servidor/banco a organização da OS, itens, produtos e eventos. Não aceitar cargo, organização ou autor do navegador como autorização.

Antes de usar perfil como credencial, conferir sua proteção efetiva contra autoelevação de cargo, troca de organização e reativação do próprio usuário. O SQL local não comprova essas restrições. A solução não deve ampliar permissões com base em uma verificação apenas de interface.

Escolher funções e grants mínimos para as operações novas, com `search_path` controlado e sem chave administrativa no cliente. O token público de consulta/aprovação não concede direito de arquivar ou desarquivar.

## 16. Dados e contratos propostos

| Estrutura | Escopo |
| --- | --- |
| `work_orders` | Aceitar `arquivado`; metadados de arquivamento e instante de entrada no status. |
| Evento de arquivamento/desarquivamento | Organização, OS, ciclo, chave de operação, usuário, instante, origem/destino e snapshot de itens/produtos/quantidades devolvidas. Preservar histórico. |
| Estado do lembrete | Próxima oportunidade por organização e usuário, com proteção entre dispositivos. |
| Política | Prazo de 15 dias e cadência escolhida. Evitar uma tela de configuração extensa na primeira versão. |

Não incluir estados de débito legado, classificação inicial de peças antigas ou tabela geral de movimentos de todos os escritores de estoque.

Contratos propostos: consulta paginada do fluxo visual; consulta dos candidatos e prévia; arquivar; desarquivar; registrar/adiar apresentação do lembrete. Chave da operação identifica ação, organização e OS; prévia deve detectar alterações relevantes.

Erros de autenticação, permissão, estado, vínculo ou item inválido não produzem crédito parcial. Mostrar mensagens de produto compreensíveis, sem SQL ou dados de credenciais.

O resultado persistido por chave de arquivamento deve guardar a operação, o snapshot efetivamente creditado e a resposta confirmada. Reconhecer repetição idêntica antes de exigir novamente `orcamento`; rejeitar chave reutilizada com conteúdo diferente. Depois de devolver sucesso histórico, consultar o estado corrente para a interface.

## 17. Superfícies a ajustar

| Superfície | Mudança |
| --- | --- |
| Dashboard | Card de entrada, contador com escopo explícito e exclusão de arquivadas das pendências operacionais pertinentes. |
| Atendimento/lista | Acesso ao painel, rótulo/filtro de arquivadas e botão de revisão. |
| Detalhes da OS | Confirmar arquivamento, mostrar estado, impedir ações incompatíveis e permitir desarquivar conforme permissão. |
| APIs/ações de OS | Operações transacionais e proteção de estado, incluindo aprovação, cancelamento, exclusão e reabertura. |
| Portal | Consulta histórica preservada; impedir aprovação de arquivada; não somar orçamento arquivado como obrigação operacional no extrato. |
| Agenda/vínculos | Respeitar a política escolhida e a proteção da OS. |
| Banco | Status, eventos restritos ao ciclo, lembretes e operações necessárias. |

Não migrar cadastro/importação/ajuste de todo o estoque para um novo gateway geral. Não alterar a quantidade de OS históricas, os saldos gerais ou os itens para “corrigir” passado durante a implantação.

No mesmo lançamento que introduzir `arquivado`, atualizar explicitamente o extrato do portal e as previsões de entrega do dashboard para excluir esse status dos respectivos totais operacionais, preservando consulta histórica (P2-V5-02). Garantir proteção efetiva de afiliação e cargos antes de usá-los para conceder o novo acesso; a auditoria identificou que os scripts locais não comprovam essa proteção, sem concluir o estado remoto (P2-V5-03).

## 18. Sequência de entrega

1. Incorporar esta decisão de estoque e fechar somente as escolhas de produto ainda pendentes. Conferir esquema/permissões necessários ao novo status e operações, sem inventário de estoque da NHT.
2. Preparar migração e operações em ambiente isolado: status, evento por ciclo, confirmação transacional, devolução por quantidade da OS e proteção contra repetição/caminhos alternativos.
3. Integrar arquivamento individual, consulta histórica, filtros e lembretes. Tratar desarquivamento conforme a política escolhida.
4. Implementar painel visual, seleção, celular/tablet e entradas no dashboard/Atendimento. O painel de consulta pode ser entregue separadamente.
5. Validar os cenários da seção 19, conferir compatibilidade do ambiente de destino e publicar em ordem compatível: banco antes dos clientes que exigem as funções novas.

Não condicionar essas etapas a reconstruir baixas passadas ou a contar as 69 OS informadas. Não executar arquivamento em massa durante publicação.

Se houver falha de implantação, desabilitar novas ações preservando leitura e eventos. Não desfazer créditos em massa, apagar eventos ou voltar a um cliente que permita nova devolução por cancelar/excluir uma arquivada.

## 19. Critérios de aceite e testes

| Cenário | Resultado esperado |
| --- | --- |
| OS só de serviços | Arquiva, sai do fluxo e não altera nenhum produto. |
| OS antiga com 2 peças da loja vinculadas | Credita 2 mesmo sem histórico de baixa; grava evento e status juntos. |
| Duas linhas do mesmo produto, 1 e 2 unidades | Credita 3 e preserva as linhas no snapshot. |
| Peça do cliente e serviço na mesma OS | Nenhum crédito por esses itens. |
| Item sem produto vinculado | Preservado, sem criar produto/saldo; prévia informa a ausência de movimento. |
| Produto inexistente ou de outra organização | Operação rejeitada integralmente. |
| Quantidade fracionada | Não trunca e preserva precisão. |
| Saldo negativo | Soma apenas a quantidade devolvida; não zera nem inventaria. |
| Falha em produto, evento ou status | Reverte todas as escritas da operação. |
| Duplo clique, repetição após timeout ou chaves distintas concorrentes | Uma devolução para aquela transição; resultado confirmado pode ser reapresentado. |
| Itens alterados depois da prévia | Pede nova confirmação sem crédito parcial. |
| Aprovação concorrente | Apenas uma transição vence; a perdedora não produz efeitos. |
| Cancelar/excluir/reabrir arquivada por tela ou chamada antiga | Rejeita antes de qualquer nova devolução ou efeito incompatível. |
| Desarquivar e arquivar de novo | Débito usa snapshot do ciclo; novo arquivamento gera um novo crédito, uma vez. |
| Outra organização ou perfil sem permissão | Sem consulta indevida ou mutação. |
| Lembrete antes/depois dos 15 dias | A sugestão respeita prazo; ação manual antes continua disponível. |
| Várias abas/dispositivos | Uma apresentação por oportunidade de lembrete. |
| Busca fora da primeira página | Busca/contagem feitas no servidor por ID parcial, cliente/modelo e placa normalizada. |
| Celular/tablet, teclado e redução de movimento | Filas, seleção, retorno e informações utilizáveis. |
| Crédito do arquivamento contra escrita absoluta antiga | Exercitar duas sessões e registrar se o crédito é sobrescrito; se adotada proteção, a escrita antiga deve falhar ou revalidar sem apagar o crédito. Não anunciar garantia global sem essa prova. |
| Recibo, checkout, portal e reabertura concorrentes | Validar estado sob controle da OS antes de crédito, mudança de status ou exclusão de comissões; falha sem efeitos parciais. |
| Extrato e previsão de entrega | OS arquivada não compõe pendências operacionais e continua consultável no histórico. |
| Erro, vazio e falta de autorização nas filas | Três estados distintos; nenhum erro de consulta aparece como lista vazia confirmada. |

Os testes futuros devem demonstrar a regra simplificada, sem restaurar uma exigência de comprovação de baixa anterior. Os testes existentes da correção pontual de quantidade não substituem os testes de arquivamento.

## 20. Situação das decisões

| Tema | Situação |
| --- | --- |
| Prazo e ação manual — D01 | Decidido: sugestão após 15 dias, manual permitido antes. |
| Devolução de estoque antigo — D06 | Decidido: devolver a quantidade atual das peças da loja vinculadas ao arquivar. Sem diagnóstico prévio de estoque como requisito. |
| Protocolo geral de estoque — antiga D07 | Retirado deste escopo. Permanecem transação, validação de organização e proteção contra duplicidade da operação de arquivar. |
| Edição e linhas separadas — D18 | Decidido: quantidade comprometida acompanha a edição na própria linha nos dois sentidos. Não impor segunda linha nem classificação de legado. |
| Lembrete — D02/D05 | Propostas: a cada 3 dias; usar criação como estimativa identificada para orçamento preexistente. Ainda não foram aprovadas expressamente. |
| Cargos — D04 | Proposta: dono, administrador e gerente. Ainda não aprovada expressamente. |
| Desarquivar sem saldo — D08 | Política pendente; bloqueio integral é proposta anterior. |
| Obrigações/agenda — D09/D10 | Impedimentos da seção 14 permanecem propostas. Não estornar ou cancelar vínculos automaticamente. |
| Alcance sem veículo — D11 | Proposta inicial de arquivamento para OS com veículo; eventual ampliação para bancada é separada do desenho de carros. |
| Visual — D03/D12/D13/D15 | Faixas de cor e detalhes de apresentação permanecem propostas; nome “Fluxo visual”, mais antigas primeiro, página de 20 e prévia ilustrativa. |
| Exclusão — D16 | Proposta: bloquear exclusão/cancelamento de arquivada que faria nova devolução; preservar histórico. Não ampliar para proibir toda exclusão histórica do sistema. |
| Aguardando peça — D17 | Escolher comando explícito futuro ou manter a fila como leitura dos registros existentes. Não bloquear as demais filas por essa escolha. |

Questões técnicas de transação, escopo de organização, concorrência e compatibilidade serão resolvidas na implementação. Não criar novas rodadas de decisão sobre prova de baixa antiga, ledger ou inventário: o usuário retirou esses requisitos deste projeto.

**Decisão adicional ainda não tomada, P2-V5-01:** aceitar explicitamente o risco de um escritor antigo sobrescrever uma devolução concorrente ou implementar uma proteção que cubra tais escritores. Uma transação somente no arquivamento não resolve essa corrida. A escolha não modifica a regra de devolver a quantidade da OS.

## 21. Histórico e documentos relacionados

- [Versão 1 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md) e [primeira auditoria](AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md).
- [Versão 2 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V2_AUDITADO.md) e [segunda auditoria](AUDITORIA_V2_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md).
- [Versão 3 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V3_AUDITADO.md) e [terceira auditoria](AUDITORIA_V3_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md).
- [Versão 4 antes desta simplificação](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V4_ANTES_SIMPLIFICACAO_ESTOQUE.md), sem parecer independente V4 apresentado até esta revisão.
- [Versão 5 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V5_AUDITADO.md) e [auditoria V5](AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md).
- [Correção pontual da baixa de peças](CORRECAO_BAIXA_PECAS_OS.md).
- Referências visuais: [carro](referencias-fluxo-visual/01-estilo-carro.png), [filas](referencias-fluxo-visual/02-estudo-filas-tablet.png), [seleção](referencias-fluxo-visual/03-estudo-selecao-tablet.png) e [celular](referencias-fluxo-visual/04-estudo-mobile.png).

A revisão 5 registra uma mudança de escopo deliberada. Os achados antigos sobre falta de prova de baixa não foram “corrigidos” no passado; deixou de ser requisito provar essa baixa para aplicar a regra escolhida de devolução por quantidade da OS. Os relatórios e as cópias anteriores não foram alterados.

## 22. Resposta documental à auditoria V5

| Achado | Tratamento nesta revisão | Situação |
| --- | --- | --- |
| P1-V5-01 | Seção 13 explicita os caminhos da OS, recibo, checkout, portal e reabertura e exige validação antes dos efeitos na mesma transação. | Não implementado; requisito para habilitar arquivamento com dados reais. |
| P2-V5-01 | Seção 11.3 explica a sobrescrita por valor absoluto; decisão e prova de contenção continuam abertas. | Risco não resolvido nem aceito por suposição. |
| P2-V5-02/03 | Seções 15 e 17 mantêm proteção de afiliação e ajustes de extrato/previsão como pré-requisitos. | Código e políticas instaladas não foram alterados nem verificados. |
| P3-V5-01 | Seção 8 distingue erro, vazio e ausência de autorização. | Contrato documental; tela futura. |
| P2-B-01/02/03, P3-B-01 | Ver [correção de peças](CORRECAO_BAIXA_PECAS_OS.md) e [plano de resposta](PLANO_RESPOSTA_AUDITORIA_V5_CORRECAO_PECAS.md). | Correção existente permanece inalterada; alterações e testes propostos não foram executados. |

Painel, lembrete e regra simplificada podem ser desenvolvidos em ensaio conforme o parecer V5. Esta revisão não constitui implementação ou autorização automática para dados reais.
