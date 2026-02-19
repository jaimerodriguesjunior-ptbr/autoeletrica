# Novidades - Fevereiro 2026

## 1. Importação de Nota Fiscal (XML)
Uma nova funcionalidade que permite arrastar e soltar arquivos XML para atualizar o estoque automaticamente.
- **Como usar:** Vá em `Estoque > Importar XML`.
- **Drag & Drop:** Arraste o arquivo XML da nota fiscal para a área indicada.
- **Conciliação Inteligente:** O sistema tenta encontrar o produto pelo Código de Barras (EAN) ou Nome.
- **Criação Automática:** Se não encontrar, ele sugere criar um novo cadastro.
- **Atualização de Preços:**
    - **Custo de Reposição:** Atualizado com o valor da nota.
    - **Preço de Venda:** *Não* é alterado automaticamente para produtos existentes (segurança).
    - **Data da Compra:** Atualizada automaticamente para a data atual.
- **Financeiro:** Gera uma despesa "Pendente" no financeiro para controle.

## 2. Alertas de Estoque e Preço
Melhorias na visualização e gestão do estoque para evitar prejuízos.
- **Alerta de Preço Defasado (Amarelo):** Aparece quando o **Custo de Reposição** (hoje) é maior que o **Custo Real** (pago antigamente). Indica que sua margem diminuiu.
- **Alerta de Inatividade (Azul):** Novo alerta "Revisar Custo" que aparece quando um produto não tem entrada de nota há mais de **90 dias**. Serve para te lembrar de conferir se o preço do fornecedor mudou.
- **Como Resolver:** Ao atualizar o "Custo Real" na edição do produto, o alerta some.

## 3. Correções no Dashboard Financeiro
- **Filtro Mensal:** Agora os gráficos e totais respeitam corretamente o filtro de data (ex: "Este Mês").
- **Visualização:** Melhorado o contraste e o layout dos gráficos.

## 4. Edição de Produto
- **Novo Campo:** Adicionado campo "Data da Última Compra" na aba de Precificação.
- **Segurança ao Excluir:** Mensagem amigável ao tentar excluir um produto que já foi usado em uma Ordem de Serviço (o sistema impede a exclusão para manter o histórico).

## 5. Armazenamento de XML (Fiscal)
- **Backup de Notas:** Agora, ao importar uma nota fiscal, o sistema salva automaticamente o **XML Completo** e a **Chave de Acesso** no banco de dados.
- **Preparado para o Futuro:** Isso permitirá criar o Portal do Contador e fazer devoluções de produtos referenciando a nota original.
