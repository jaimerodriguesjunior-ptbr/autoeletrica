# Devolução de NF-e: CFOP por produto

## Estado atual

Temporariamente, a emissão de devolução da Autoelétrica usa o CFOP padrão:

- `5202` em operação interna;
- `6202` em operação interestadual.

Foi removido o mapeamento pontual que convertia automaticamente CFOPs de
combustível/lubrificante (`5655/6655` para `5661/6661`) e outros CFOPs de ST.

## Por que não aplicar a regra diretamente aqui

Uma NF-e de entrada pode conter produtos com CFOPs diferentes. O CFOP da
devolução precisa ser resolvido por item, considerando produto, operação,
UF, finalidade e tributação. A Nuvem Local também precisa validar e gerar o
XML compatível com cada perfil.

O suporte ao grupo XML de combustível permanece disponível, mas ele só deve
ser usado junto com uma regra de CFOP por produto validada.

## Próxima etapa

Centralizar na Nuvem Local um catálogo/regra de devolução que receba o CFOP da
origem por item e devolva o CFOP, o grupo de combustível e o tratamento
tributário aplicáveis. Depois disso, a Autoelétrica deve consumir essa regra
sem manter mapeamentos fiscais pontuais no próprio aplicativo.
