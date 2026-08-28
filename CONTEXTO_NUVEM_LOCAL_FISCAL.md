# Contexto obrigatório — Nuvem Local Fiscal

## Regra de leitura

Este documento deve ser lido no início de todo novo contexto que envolva
emissão fiscal, NFS-e, NFe, NFC-e, certificados, credenciais, webhooks ou
integrações com provedores fiscais.

## Nomenclatura oficial do projeto

**Nuvem Fiscal é somente um nome legado.** Não tratar a Nuvem Fiscal como o
provedor externo atualmente utilizado pelo projeto.

O nome correto da integração local é:

- Produto/integração: **Nuvem Local Fiscal**
- Identificador técnico: **`nuvem-local-fiscal`**
- API base: definida pelas variáveis de ambiente do projeto, normalmente
  `NUVEM_FISCAL_API_URL` e `NUVEM_FISCAL_TOKEN` por compatibilidade histórica
- Código principal relacionado: `src/actions/fiscal.ts` e
  `src/actions/fiscal_emission.ts`

## Compatibilidade com código existente

Ainda existem nomes, comentários, variáveis de ambiente, endpoints e textos
com `nuvemfiscal` ou “Nuvem Fiscal”. Isso é compatibilidade histórica e não
deve ser interpretado como decisão de arquitetura ou autorização para trocar
o provedor.

Ao criar código novo:

1. Use “Nuvem Local Fiscal” em textos, documentação e mensagens visíveis.
2. Use `nuvem-local-fiscal` como identificador conceitual/técnico quando um
   identificador novo for necessário.
3. Preserve nomes legados apenas quando a mudança puder quebrar configuração,
   banco, API, scripts ou produção.
4. Não introduza uma segunda integração externa chamada “Nuvem Fiscal”.
5. Não substituir endpoints ou credenciais sem confirmar o contrato da Nuvem
   Local Fiscal e verificar o ambiente de homologação/produção.

## Arquitetura fiscal resumida

- O sistema local mantém os dados da empresa em `company_settings`.
- A emissão é disparada pelo backend e encaminhada à Nuvem Local Fiscal.
- A NFS-e pode seguir fluxo municipal/provedor específico ou fluxo nacional,
  conforme município, configuração da empresa e suporte disponível.
- A empresa prestadora, o tomador, o serviço, o código municipal/nacional,
  ISS, retenções e ambiente precisam ser coerentes antes do envio.
- XML, PDF, chave, status, cancelamento e consultas devem ser tratados como
  documentos fiscais e não apenas como respostas genéricas da API.

## Dados que normalmente são necessários

- CNPJ, razão social, endereço e código IBGE do município;
- inscrição municipal, regime tributário e CNAE;
- código do serviço municipal e código nacional quando aplicável;
- alíquota, retenções e regras de ISS definidas pelo contador/município;
- credenciais ou certificado digital exigidos pelo município/ambiente;
- numeração de RPS/DPS e série;
- dados completos do tomador e descrição do serviço.

## Cuidados para novos diagnósticos

- Primeiro identificar o município e o fluxo efetivamente selecionado.
- Separar CNAE de código de serviço: não usar um como substituto do outro.
- Conferir o payload enviado, a resposta imediata e o status posterior do
  documento na Nuvem Local Fiscal.
- Não apagar nem substituir credenciais, numeração ou documentos fiscais para
  “testar”. Preferir homologação, logs redigidos e consultas não destrutivas.
- Nunca registrar senhas, tokens ou certificados em commits, documentação,
  logs ou mensagens de erro.

## Documentos relacionados

- `CONTEXTO_NFSE_GUAIRA.md` — histórico técnico específico de Guaíra/IPM.
- `REGISTRO_NFSE_GUAIRA_2026-07-29.md` — registro de emissão e correções.
- `src/actions/fiscal.ts` — cadastro/sincronização fiscal da empresa.
- `src/actions/fiscal_emission.ts` — montagem e envio de documentos fiscais.
