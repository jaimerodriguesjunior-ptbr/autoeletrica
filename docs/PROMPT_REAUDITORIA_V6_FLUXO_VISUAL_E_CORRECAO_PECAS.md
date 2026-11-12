# Prompt completo: auditoria independente do plano V6

Você está em uma sessão independente, sem histórico do chat. Audite a revisão documental do fluxo visual 2,5D, do arquivamento de OS e da resposta planejada à auditoria da correção de estoque. Workspace: `G:\projetos\autoeletrica`.

Leia `AGENTS.md`; antes de analisar código ou integração fiscal leia `CONTEXTO_NUVEM_LOCAL_FISCAL.md`. A integração chama-se Nuvem Local Fiscal. Este pedido autoriza somente leitura local e a criação de um relatório novo em `docs/AUDITORIA_V6_FLUXO_VISUAL_E_CORRECAO_PECAS.md` (use nome numerado caso já exista). Não altere plano, código, migrações, documentos anteriores ou dados; não aplique migrações, publique ou consulte banco remoto. Não exponha credenciais ou dados pessoais. Testes isolados existentes podem ser executados após examinar o script e comprovar que não acessa serviços reais; não instale pacotes pela rede.

## Arquivos e identidade

- Plano vigente: `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`, versão 6. SHA-256 esperado quando este prompt foi criado: `E63F49080CCE0BA9ECF9CFADFF789B9559D2212B6298679DBF44BA0095195814`. Calcule o hash efetivamente lido e identifique qualquer diferença.
- Plano V5 auditado preservado: `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V5_AUDITADO.md`, SHA-256 `6A2FD3D4E884F0509FCDB1CBE5C09F2E8759BE1471C227D5DB868B9D779EC0F7`.
- Relatório anterior: `docs/AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md`.
- Resposta planejada específica para a correção local: `docs/PLANO_RESPOSTA_AUDITORIA_V5_CORRECAO_PECAS.md`.
- Código local separado: `app/(admin)/os/detalhes/[id]/page.tsx`, `migration_os_part_stock.sql`, `scripts/test_os_part_stock.cjs`, `docs/CORRECAO_BAIXA_PECAS_OS.md`. A correção já foi codificada e testada localmente; a resposta aos achados V5 é plano, não código novo. Calcule hashes atuais e compare com o relatório V5; não trate Git ou arquivos locais como prova da instalação remota.

Leia integralmente V6, relatório V5 e plano de resposta. Examine o código relevante e confirme independentemente. Diferenças entre plano, código atual, hipótese de concorrência e estado remoto desconhecido devem ser identificadas. Os 69 registros NHT e a maioria de serviços foram informados pelo usuário; não foram contados.

## Requisitos acordados

Painel com cinco filas (`orcamento`, `aprovado`, `aguardando_peca`, `em_servico`, `pronto`), um carro 2,5D genérico por OS, cor pela idade desde abertura, seleção em destaque e funcionamento em celular/tablet. Representa fluxo, mesmo que o carro esteja com o cliente; não depende de vagas. Dashboard e Atendimento abrem a mesma tela; miniatura ilustrativa e contador real separados. Filtrar `tipo = 'os'`, veículo, organização e os cinco estados; busca/contagem no servidor. Fila de peça pode estar vazia.

O usuário escolhe arquivar OS em orçamento; lembrar após 15 dias contínuos e permitir ação manual antes. Sem status recusado e sem arquivamento automático. Ao arquivar, devolver **a quantidade atual das peças da loja vinculadas a produto**, mesmo em OS antigas e sem prova da baixa. Serviço e peça do cliente não creditam. Preservar OS e permitir desarquivar; repetição não pode creditar duas vezes. Não exigir inventário da NHT, reconciliação histórica, classificação de legado ou ledger geral como requisito de negócio; não descrever saldo resultante como estoque físico comprovado.

Edição na mesma linha: 1→2 baixa mais 1; 2→1 libera 1; preço não movimenta estoque. A correção local separada mantém política corrente de permitir saldo negativo. Regras de cadência, data estimada para OS antiga, cargos, desarquivar sem saldo, vínculos impeditivos, alcance de bancada e outras propostas da seção 20 ainda não foram aprovadas. Não inferir aceites.

## Revisão dos achados V5

1. **P1-V5-01:** confira se a V6 enumera remoção, alternância de peça do cliente, cancelar/excluir na OS, cancelamento no recibo, mudanças de status, checkout, aprovação do portal e `reopenOS`. Verifique que a proteção se aplica antes de qualquer crédito, alteração de item ou exclusão de comissão, em transações compatíveis com a trava da OS; rejeitar somente a última escrita não desfaz efeitos já confirmados. Avalie abas antigas, cliente administrativo, validação de origem, aprovação concorrente e implantação progressiva.
2. **P2-V5-01 e P2-B-03:** uma ficha pode ler saldo 5, arquivamento somar 2 e a ficha gravar 5 depois. A V6 identifica o risco como ainda aberto, sem presumir aceite. Analise se as alternativas de versão, delta ou recusa impedem a corrida também para clientes antigos e serviço, sem exigir reconstrução histórica. Não afirme que a RPC atômica, um bloqueio de linha isolado ou aviso no frontend protege um escritor absoluto posterior. Especifique a decisão pendente e alcance real da mitigação.
3. **P2-V5-02/03:** confira exclusão de arquivadas do extrato e previsões de entrega no mesmo lançamento, preservando histórico; verifique isolamento e perfil/cargo/ativo. O SQL local e as políticas instaladas são fatos distintos. Avalie os vínculos impeditivos e a necessidade de uma trava comum se eles forem adotados, sem escolher política pelo usuário. Avalie estados fiscais ativos/incertos apenas depois de ler o contexto obrigatório.
4. **P3-V5-01:** a V6 distingue carregamento, vazio, erro e falta de autorização nas filas e conserva busca/contagem antes da paginação, ID parcial e placa normalizada não vazia? Não tratar busca atual como modelo pronto.
5. **P2-B-01:** avalie o contrato proposto para idempotência da inclusão: mesma chave, ator/organização/OS e conteúdo canônico retorna mesmo resultado, sem novo débito; conteúdo diferente rejeitado; chaves distintas permitem duas inclusões intencionais. Avalie armazenamento seguro e durável da tentativa/resposta após recarga, timeout depois do commit, duas sessões concorrentes, segurança, retenção, reuso após mudança de status e falha de reconciliação. `useRef` e atualização da lista sozinhos não provam idempotência. A proposta ainda não foi implementada.
6. **P2-B-02:** confira a proposta para cadastro confirmado com inclusão comprovadamente falha, botão protegido antes do INSERT e distinção entre falha confirmada e resposta incerta. O produto pode continuar cadastrado; a orientação deve informar o estado real e evitar cadastro duplicado. Avalie os caminhos de cadastro, scanner e catálogo global, sem presumir que foi implementado.
7. **P3-B-01:** compare status aceitos na RPC e botões da tela, inclusive `em_andamento` e nulos. Identifique a necessidade de verificar compatibilidade no destino sem inferir dados reais e sem ampliar permissões por suposição.
8. **Ciclo:** percorra prévia, soma de várias linhas por produto, produto sem vínculo, peça de cliente, fração e saldo negativo; locks em ordem, snapshot do evento, chave do arquivamento, replay após desarquivar e ciclos seguintes. Desarquivar usa o crédito efetivo do ciclo; falta de saldo é escolha pendente. Não requerer prova de baixa anterior.
9. **Regressões e escopo:** a V6 não pode inventar aceite da política de saldo ou dos bloqueios financeiros/fiscais, reintroduzir a classificação de legado ou requerer ledger/inventário. Avalie o que pode ser desenvolvido isoladamente e o que impede habilitação segura, sem converter recomendações em mudança de negócio.

## Fontes e validação

Além dos arquivos acima, examine os caminhos em `app/(admin)/recibo/[id]/page.tsx`, `app/(admin)/atendimento/nova-venda/page.tsx`, `app/(admin)/estoque/[id]/page.tsx`, importação de estoque, `src/actions/os.ts`, portal de aprovação/extrato, dashboard, lista de atendimento, migrações RLS, perfil e agenda. Depois do contexto fiscal, examine as migrações locais de prevenção de duplicidade e `src/lib/work-order-fiscal.ts`; não confundir duplicidade com guarda geral.

Se executar `node scripts/test_os_part_stock.cjs` e `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`, relate os resultados reais. Os 15 cenários anteriores eram PGlite com esquema sintético e uma conexão; não provam concorrência entre sessões, navegador, RLS real, estado remoto ou a idempotência proposta. Não instale pacotes nem use dados reais.

## Relatório

Para cada achado: ID/prioridade, natureza, bloco, referência de documento e arquivo/linha, cenário concreto, efeito, confiança, solução mínima e prova necessária. Distinguir erro atual, risco futuro e decisão de negócio. Classifique individualmente cada achado V5 como suficiente/parcial/insuficiente no texto e deixe claro que mudanças de plano não corrigem o sistema.

Forneça parecer separado para painel, lembretes, arquivamento, desarquivamento, correção local já existente e resposta futura a essa correção; para cada um diferencie desenvolvimento/ensaio de dados reais. Liste as decisões ainda necessárias, os riscos que não têm aceite e os testes/ordem de implantação pertinentes. Não exija outra auditoria por preferência estilística. Informe claramente o que foi e o que não foi executado. O relatório não autoriza implementação, banco remoto ou publicação.
