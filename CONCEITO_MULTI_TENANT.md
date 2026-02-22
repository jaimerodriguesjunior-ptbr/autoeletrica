# Guia Base para Migração Multi-Tenant (Supabase)

Este documento guarda os passos discutidos com o Gemini e validados pelo Assistente, cruzando com a real situação do seu código (onde a integração da NFS-e de Guaíra já é dinâmica).

*Dica de Segurança Inicial: Sempre rode o script `backup_completo.sql` antes de iniciar.*

## Passo 1: Garantir e Identificar a Organização Atual
- Checar na tabela `organizations` se o "Norberto" (a primeira e atual oficina) já existe como uma linha lá (provavelmente sim).
- **Anotar o UUID da organização primária.**
- Se não existir, criar a linha para o Norberto.

## Passo 2: O Grande "Carimbo" Retroativo (Preservação de Dados)
Como a estrutura atual já possui a chave `organization_id` na maioria das tabelas, o foco não é criar colunas, mas sim garantir que não existam dados "órfãos".
- **Ação:** Rodar um script SQL que verifica TODAS as tabelas vitais (`clients`, `work_orders`, `fiscal_invoices`, `transactions`, `products`) e **ATUALIZA (UPDATE)** as linhas que estiverem com `organization_id` vazio/nulo, definindo-o obrigatoriamente para o UUID levantado no Passo 1.
- *Propósito:* Garantir que a oficina 1 (Norberto) seja juridicamente dona de todos os dados do passado.

## Passo 3: Revisão Crítica das Políticas RLS (Row Level Security)
Esta é a barreira contra vazamentos. É a prioridade real do banco de dados na migração.
- **Ação:** Conferir/Ativar a segurança RLS em cada uma das tabelas operacionais.
- **Regra Geral a Aplicar:** *"Um funcionário logado (auth.uid()) pertence a um ou mais perfis (`profiles.organization_id`). Ele só pode realizar SELECT, INSERT, UPDATE, DELETE em registros onde o `organization_id` bata com o seu próprio perfil."*
- Sem isso ajustado perfeitamente, o funcionário da oficina 2 consegue visualizar dados da oficina 1 se forçar a URL ou usar a API diretamente.

## Passo 4: Adição da Nova Organização
- Cadastrar a "Oficina 2" na tabela de `organizations`.
- Vincular os novos perfis (funcionários) à Oficina 2 na tabela `profiles`.

## Passo 5: Configuração de Emissão Fiscal (Nuvem Fiscal)
- O código atual (em `src/actions/fiscal_emission.ts`) já está ótimo: ele usa o `organization_id` para buscar (`company_settings.nfse_login`, `cnpj`, senhas, etc).
- **Ação Restante:** Povoar a linha na tabela `company_settings` com os dados fiscais da *Oficina 2*, garantindo que ela tenha suas próprias amarrações de certificado, CNPJ e senha municipal para a NFSe lá em Guaíra.

---
Quando tiver tempo e paz de espírito, avise: *"Vamos começar o Passo 1 do Multi-tenant!"*, e pegaremos a partir daqui revisando o SQL de cada etapa, rodando sem pressa!
