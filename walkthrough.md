# Diagnóstico de Emissão NFS-e - Guaíra (PR)

## Resumo do Problema
A emissão de NFS-e para o município de Guaíra (PR), que utiliza o sistema IPM, está falhando consistentemente com o erro:
**`00060: Código da situação tributária não está preenchido corretamente.`**

## Testes Realizados

Utilizamos um script de debug direto (`scripts/debug_guaira_nfse.ts`) para isolar a comunicação com a Nuvem Fiscal e testar diferentes combinações de dados.

### 1. Testes de Valor `cSitTrib` (Situação Tributária)
A documentação da IPM (Nota Técnica 35/2021 v2.8) especifica:
- `0`: Tributada Integralmente
- `1`: Tributada Integralmente com ISSRF
- `6`: Isenta

Resultados:
| Valor Testado | Status Nuvem Fiscal | Status Prefeitura | Erro |
| :--- | :--- | :--- | :--- |
| `"0"` | Aceito (200) | Rejeitado | `00060` |
| `"1"` | Aceito (200) | Rejeitado | `00060` |
| `"6"` | Aceito (200) | Rejeitado | `00060` |
| `null` | Aceito (200) | Rejeitado | `00060` |
| `"00"` | Rejeitado (400) | - | Formato inválido (Regex Nuvem Fiscal) |
| `"01"` | Rejeitado (400) | - | Formato inválido (Regex Nuvem Fiscal) |

### 2. Testes de Formato de Códigos
Tentamos variar os códigos de serviço e tributação para verificar se influenciavam a validação da situação tributária.

| Campo | Valor Testado | Resultado |
| :--- | :--- | :--- |
| `cTribNac` | `"14.01"` | Erro `00383` (Lista sem desdobramento) |
| `cTribNac` | `"1401"` | Erro `00383` (Lista sem desdobramento) |
| `cTribNac` | `"140102"` | Erro `00060` (Situação Tributária) - **Código Correto** |
| `cTribMun` | `"4520007"` (CNAE) | Erro `00060` |
| `cTribMun` | `"140102"` | Erro `00060` |

### 3. Testes de Regime Tributário
Verificamos se o regime tributário da empresa (Simples Nacional vs Normal) afetava a aceitação.

| Regime | Resultado |
| :--- | :--- |
| Normal | Erro `00060` |
| Simples Nacional (6) | Erro `00060` |
| MEI (5) | Erro `00060` |

### 4. Teste de Inconsistência Forçada
Enviamos `cSitTrib="0"` (Tributada) com dados de Isenção (`tribISSQN=3`) para ver se a prefeitura reconhecia o valor "0" e retornava um erro de lógica (ex: erro 62).
- **Resultado:** Erro `00060`.
- **Conclusão:** A prefeitura não está sequer reconhecendo o valor "0" como válido, ou a tag está chegando vazia/incorreta via integração da Nuvem Fiscal.

## Conclusão Técnica
O erro `00060` persiste independentemente do valor enviado, desde que o formato seja aceito pela Nuvem Fiscal. Isso sugere fortemente que:
1.  **Integração:** A Nuvem Fiscal pode estar gerando o XML para a IPM com a tag `<situacao_tributaria>` em um formato não aceito (ex: faltando zeros à esquerda que a API JSON bloqueia, ou namespace incorreto).
2.  **Cadastro:** Pode haver uma pendência cadastral específica da empresa na prefeitura que impede a validação da tributação (ex: atividade não vinculada corretamente).

## Ações Realizadas
- O código da aplicação foi restaurado para usar o valor documentalmente correto: **`cSitTrib: "0"`**.
- Foram adicionados logs detalhados na resposta da Nuvem Fiscal para facilitar a abertura de chamados de suporte.
- O script de debug foi mantido em `scripts/debug_guaira_nfse.ts` para uso futuro.

## Tentativa de Integração Direta (IPM) - 26/01/2026

Para descartar problemas na camada da Nuvem Fiscal, implementamos uma integração direta com o webservice da IPM (`scripts/test_direct_ipm.ts`).

### 1. Conexão
- **Sucesso:** Conseguimos autenticar e enviar requisições POST com XML diretamente para o endpoint `https://guaira.atende.net/atende.php?pg=rest&service=WNERestServiceNFSe&cidade=padrao`.
- **Autenticação:** Basic Auth com CNPJ e Senha funcionou perfeitamente.

### 2. Resultados dos Testes (Erro 00060 Persistente)
Mesmo enviando o XML diretamente, o erro **`00060 - Código da situação tributária não está preenchido corretamente`** persistiu em **TODOS** os cenários abaixo:

| Teste | Valor/Cenário | Resultado |
| :--- | :--- | :--- |
| **Valores Padrão** | `0`, `1`, `6` | Erro `00060` |
| **Força Bruta** | `2` a `10` | Erro `00060` |
| **Formatos** | `"00"`, `"01"`, `"T"`, `"I"` | Erro `00060` ou Erro XSD (Tipo Inválido) |
| **Tags Extras** | `<optante_simples_nacional>`, `<inscricao_municipal>`, `<iss_retido>`, `<natureza_operacao>` | **Erro XSD:** Elemento não esperado (Schema Strict) |
| **Remoção** | Remover tag `<situacao_tributaria>` | **Erro XSD:** Elemento obrigatório faltando |
| **Ordem** | Mover tag para início da lista | Erro `00060` |

### 3. Diagnóstico Final
- **Não é falha da Nuvem Fiscal:** O erro vem diretamente do validador da prefeitura/IPM.
- **Validação Rigorosa:** O Schema XSD da prefeitura é extremamente restrito e rejeita tags comuns de outros layouts (como `optante_simples_nacional` dentro do item).
- **Bloqueio:** Não é possível "adivinhar" o código correto pois todas as tentativas lógicas falharam. É provável que para empresas do **Simples Nacional** em Guaíra exista um código numérico específico (diferente do padrão ABRASF) ou uma combinação de campos que não está documentada publicamente.

### 4. Próximos Passos (Bloqueado)
Aguardando retorno do contador/suporte com:
1.  **Manual de Integração XML** específico de Guaíra/IPM (páginas sobre `situacao_tributaria`).
2.  **Exemplo de XML válido** de uma nota emitida manualmente pelo portal.

## Tentativa com Dados do Contador (27/01/2026)

Recebemos a informação de que a alíquota correta é **6%** (Simples Nacional) e que deveríamos usar:
- `situacao_tributaria`: 0 (Tributada Integralmente)
- `aliquota_item_lista_servico`: 6.00
- `valor_issrf`: 0.00

### Resultados dos Testes (Erro 00060 Persiste)

Utilizamos o script de bypass (`scripts/test_direct_ipm.ts`) para garantir envio exato dos dados.

| Teste | Parâmetros | Resultado |
| :--- | :--- | :--- |
| **Alíquota 6,00** | Rate: `6,00`, SitTrib: `0`, ISSRF: `0,00` | **Erro 00060** |
| **Alíquota 6** | Rate: `6`, SitTrib: `0`, ISSRF: `0,00` | **Erro 00060** |
| **Alíquota 6,0** | Rate: `6,0`, SitTrib: `0`, ISSRF: `0,00` | **Erro 00060** |
| **Ponto (6.00)** | Rate: `6.00` | **Erro XSD** (Formato inválido, exige vírgula) |
| **Com Valor ISS** | Adicionado tag `<valor_iss>` | **Erro XSD** (Elemento não esperado) |

### Conclusão
A alteração da alíquota para 6% e o uso de `sitTrib=0` **NÃO** resolveram o problema. O sistema da prefeitura continua rejeitando a combinação com o erro genérico de situação tributária. É possível que para Simples Nacional o código `0` não seja o correto, ou falte algum outro campo específico não documentado.

## Diagnóstico Definitivo (02/02/2026)

Após análise detalhada do código (`fiscal_emission.ts` e `page.tsx`) comparado às práticas comuns da IPM, identificamos as inconsistências que causam o erro `00060` (Situação Tributária):

1.  **Código Municipal Incorreto (`cTribMun`)**: O código atual envia o CNAE (`4520007`) neste campo. Para IPM, este campo deve conter o **Código do Serviço** (ex: `140102`). O CNAE só deve ir no campo `<CNAE>`.
2.  **Dados Ausentes no Payload**: O frontend (`page.tsx`) não está repassando o `codigo_servico` e `aliquota_iss` escolhidos para a função de emissão, forçando o uso de valores padrão incorretos.
3.  **Falta de Local da Prestação**: O XML não está incluindo os campos de local de prestação/incidência (`cLocPrestacao`), essenciais para validar se o imposto é devido no município.

### Plano de Correção
1.  **Frontend**: Alterar `page.tsx` para incluir `codigo_servico` e `aliquota` no payload enviados ao backend.
2.  **Backend**:
    *   Corrigir `cTribMun` para usar o código do serviço (LC 116).
    *   Adicionar campos de local de prestação (IBGE município).
    *   Validar mapeamento de CNAE vs Serviço.

