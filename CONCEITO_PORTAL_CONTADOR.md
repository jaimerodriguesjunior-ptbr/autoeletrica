# Conceito: Portal do Contador (Acesso Restrito)

Este documento descreve o plano para criar uma área de acesso exclusivo para contadores, facilitando a troca de arquivos fiscais e a correção de dados tributários sem dar acesso total ao painel administrativo.

## 1. O Fluxo de Acesso
Em vez de um usuário e senha tradicional, o contador acessa via:
- **Link Único:** Gerado pelo sistema para cada oficina (ex: `/portal-contador/550e8400-e29b-41d4...`)
- **PIN de Segurança:** Um código de 4 ou 6 dígitos definido pelo dono da oficina.

## 2. Estrutura do Banco de Dados
Adicionar à tabela `organizations`:
- `accounting_token` (text): Um hash aleatório e único.
- `accounting_pin` (text): O PIN cadastrado para acesso.

## 3. A Tela do Contador (Funcionalidades)

### A. Dashboard Fiscal
- Calendário para seleção de Mês/Ano.
- Botão **"Baixar XMLs (ZIP)"**: Consolida todas as NFe, NFCe e NFSe autorizadas no período.
- Tabela de resumo: Total de Vendas, Total de Compras, Impostos Retidos.

### B. Gestor Tributário (Edição Segura)
Uma tabela simplificada da lista de produtos:
- **Visualização:** ID, Nome do Produto, Marca.
- **Edição Direta:** NCM e CFOP.
- *Nota: O contador não conseguiria alterar preço de venda ou estoque, apenas códigos fiscais.*

## 4. Segurança
- **Middleware:** O portal verifica se o `accounting_token` no link é válido.
- **Sessão:** O PIN é solicitado na primeira vez e guardado em um `cookie` de curta duração ou `sessionStorage`.
- **Restrição de IP (Opcional):** Opção de travar o link para ser acessado apenas no escritório do contador.

## 5. Benefícios
- **Autonomia:** O contador trabalha no horário dele sem te interromper.
- **Conformidade:** Correção de NCM/CFOP direto no banco, evitando erros em notas futuras.
- **Simplicidade:** Interface limpa, sem as distrações do menu administrativo.

---

> [!TIP]
> Podemos implementar isso criando uma rota dinâmica em `app/(public)/portal-contador/[token]/page.tsx`.
