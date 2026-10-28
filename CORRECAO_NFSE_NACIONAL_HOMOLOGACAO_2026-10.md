# Leitura obrigatória — NFS-e Nacional em homologação

Data do diagnóstico: 27/10/2026.

Leia este documento junto com o `README.md` antes de analisar ou alterar a
emissão nacional em homologação deste aplicativo. Ele registra uma correção
necessária no serviço compartilhado **Nuvem Local Fiscal** e a validação que
deve ser feita nos aplicativos consumidores depois da publicação da API.

## Estado confirmado em 27/10/2026

- A instância efetivamente executada pelo systemd é
  `/opt/nuvem-local-fiscal-piloto`, definida por um override do serviço.
  A publicação inicial em `/opt/nuvem-local-fiscal` não atualizava essa instância.
- Correção de XML e cadastro de empresas publicados na instância ativa, commit
  [`ddf209a`](https://github.com/jaimerodriguesjunior-ptbr/nuvem-local-fiscal/commit/ddf209a81929fc9a507a4407048dcfc9d0edc721).
- Na VPS: tipos e compilação passaram; 225 testes passaram, 9 foram
  ignorados e não houve falhas. Serviço ativo e `/ready` com HTTP 200;
  recovery e observação OG também confirmados prontos.
- O cadastro automático com certificado é uma permissão explícita por
  integração (`empresa-cadastro`), habilitada para o NF FACIL. Este documento
  não implica mudança de permissão para Autoelétrica ou Apoio Contábil.
- **Pendente:** validar uma emissão controlada de homologação por este
  aplicativo. Nenhuma emissão fiscal foi realizada nesta publicação.

## Problema confirmado

Uma tentativa em homologação retornou:

```text
NFSE_NACIONAL_DPS_REJECTED: E1235: Falha no esquema XML do DF-e.
infDPS has invalid child element cLocEmi.
Expected: cMotivoEmisTI, finNFSe.
```

A API gerava a DPS usando a estrutura anterior ao pacote de homologação
publicado em 20/10/2026. O XML passava pela validação local desatualizada,
mas era rejeitado pelo esquema da SEFIN de produção restrita.

Essa rejeição identifica um problema de estrutura do XML. Ela não comprova
que todos os dados cadastrais e fiscais do prestador e do tomador estão
corretos; essas regras precisam ser verificadas após a correção do esquema.

## Correção na Nuvem Local Fiscal

A mudança está no repositório `nuvem-local-fiscal`, que monta e assina o XML
recebido pelos aplicativos através de `POST /nfse/dps`:

1. Em homologação, inserir `<finNFSe>0</finNFSe>` após `tpEmit` e antes de
   `cLocEmi`, para a finalidade de emissão regular suportada pelo conector.
2. No grupo `cServ`, posicionar `cNBS` e `cIntContrib`, quando presentes,
   antes de `xDescServ`, conforme o novo esquema de homologação.
3. Validar o XML com o pacote oficial
   `nacional-prodrest-v1.01-20261020` em homologação.
4. Selecionar o XSD pelo ambiente do documento. Produção conserva o gerador
   e o pacote de validação usados anteriormente nesta correção.

A correção afeta os aplicativos que consomem essa instância da API, incluindo
Autoelétrica e Apoio Contábil. Não depende de trocar chaves, URLs, certificados
ou prestadores nos aplicativos. Acrescentar um campo arbitrário ao JSON do
cliente não substitui a correção do gerador XML da API.

## Diretrizes para o aplicativo consumidor

- Confirmar empresa, CNPJ, ambiente `homologacao` e provedor `nfse-nacional`
  antes da validação. Manter os parâmetros fiscais nacionais por empresa.
- Preservar a regra já validada da IM de Guaíra; em Toledo, seguir a
  configuração nacional e as regras do CNC aplicáveis ao prestador.
- Manter `dhEmi` no instante atual e tratar a competência separadamente.
- Respeitar Simples, tributação e retenção configurados; não inventar alíquota
  ou ISS zero para contornar uma rejeição de esquema.
- Preservar o identificador da Nuvem Local, série e número DPS, mensagens,
  XML e estado da tentativa. Não apagar histórico nem reiniciar numeração.
- HTTP 200/202 ou uma DPS apenas preparada não comprovam autorização.
  Conferir o estado final e o XML/DANFSe da NFS-e autorizada.
- Em `E0014` ou resultado incerto, consultar a DPS existente antes de
  considerar uma nova emissão. Não reenviar em lote por tentativa.

## Validação após publicar a API

1. Confirmar a versão implantada e a saúde da Nuvem Local.
2. Fazer uma emissão controlada em homologação a partir deste aplicativo,
   após autorização do responsável por esse teste.
3. Conferir o XML gerado e a presença/ordem de `finNFSe`, NBS e descrição.
4. Confirmar o resultado na SEFIN, o identificador persistido e os documentos
   retornados ao aplicativo. Se surgir outra rejeição, registrar o código e
   diagnosticar a regra específica sem concluir que o esquema ainda falha.

Até concluir esse teste, registrar a situação como **correção publicada na
API, validação ponta a ponta no aplicativo pendente**, quando a publicação
estiver confirmada. Este aviso não registra uma nova emissão fiscal.

## Referências oficiais e técnicas

- [Documentação de homologação da NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita)
- [Pacote oficial de XSD de 20/10/2026](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas_prod_restrita_20261020.zip)
- [Comunicado das evoluções da NT 009](https://www.gov.br/nfse/pt-br/noticias/cgnfs-e-informa-disponibilizadas-no-ambiente-de-testes-o-release-1-das-evolucoes-da-nota-tecnica-009)
- API: `src/lib/nfse-national.ts`, `src/lib/nfse-national-schema-package.ts`
  e `src/lib/nfse-national-xsd-validator.ts`.
- API: `docs/NFSE_HOMOLOGACAO_NT009_20261027.md`.

## Contexto deste aplicativo

- Aplicativo: **Autoelétrica**.
- Fluxo de emissão: `src/actions/fiscal_emission.ts`.
- Ler também [CONTEXTO_NUVEM_LOCAL_FISCAL.md](CONTEXTO_NUVEM_LOCAL_FISCAL.md), conforme o `AGENTS.md`.
