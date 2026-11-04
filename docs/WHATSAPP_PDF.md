# WhatsApp — MB Garage

## Implementação

- Configurações: chave por organização, inicialmente desligada, administrada pelo gerente (`cargo=owner`), QR code, consulta de conexão e logout independente do desligamento.
- Recibo financeiro: botão PDF somente para recebimentos efetivados. Extrato de venda: itens, total e pagamentos recebidos. Notas de saída autorizadas: PDF obtido pela rota existente da Nuvem Local Fiscal, sem alterar emissão ou credenciais fiscais.
- O navegador envia somente identificador e destinatário confirmado. O servidor verifica organização, gera/busca o documento e transmite os bytes à VPS. PDFs limitados a 10 MiB nesta implementação; não passam pelo corpo de uma resposta ao navegador.
- Cada solicitação é reservada no banco antes de chamar o provedor; não há reenvio automático. Timeout resulta em estado incerto, nunca em confirmação de entrega. A UI impede segundo clique e orienta conferir a conversa.
- Adaptador independente, sem callbacks ou banco da ótica, com sessões `mbgarage-<organization UUID>`. Nenhum recurso recebe nomes de instâncias arbitrários. Nenhum endpoint envia mensagens recebidas a bots.

## Instalação pendente

1. Aplicar `migration_whatsapp.sql` no banco do ambiente escolhido. São duas tabelas novas, sem alteração dos dados existentes. Não usar `db push` indiscriminadamente em um projeto com migrações antigas.
2. Na VPS, confirmar versão e contrato da Evolution instalada: criação, QR em `code`, connectionState, logout e sendMedia com `key.id`. Auditar webhooks **globais** antes de criar sessões: desativar webhook individual não neutraliza necessariamente webhook global. Caso o global direcione todas as sessões para a ótica, filtrar pelo prefixo das instâncias originais antes do piloto.
3. Criar um diretório separado para `services/whatsapp-bridge`. Usar `compose.example.yml` adaptando somente o nome da rede Docker existente e a URL privada da Evolution. Manter o serviço da ótica e as sessões existentes intactos.
4. Criar segredo aleatório com pelo menos 32 caracteres e configurar `.env` do adaptador. A chave da Evolution fica somente na VPS. Não versionar `.env`.
5. A VPS já possui `https://wa.mentebinaria.com` com certificado e encaminha a rota principal ao serviço da ótica. Pode-se reservar a rota `https://wa.mentebinaria.com/mbgarage` para o adaptador, sem criar um domínio novo. Preparar o bloco em `services/whatsapp-bridge/nginx-location.example.conf`, adicionar rate limiting, validar a configuração e preservar a rota existente da ótica. O limite de corpo nessa rota deve ser pelo menos 15 MiB e o timeout pelo menos 60 s. Porta 3101 permanece vinculada a localhost. Configurar `MB_WHATSAPP_BRIDGE_URL=https://wa.mentebinaria.com/mbgarage` e o mesmo `MB_WHATSAPP_BRIDGE_TOKEN` no backend do MB Garage. Preferir ambiente de teste com banco próprio antes de produção. Esta rota ainda não foi instalada.
6. Gerente da DOM ativa a chave e lê o QR code com o aparelho da oficina. Acompanhar RAM/swap da VPS durante conexão/envio; evitar sincronizar histórico.
7. Com autorização do destinatário de teste, enviar recibo parcial, venda com item do cliente e nota autorizada. Conferir conteúdo e identidade da oficina no aparelho. Validar duas organizações, permissão de funcionário, desligamento, logout e indisponibilidade do provedor. Não enviar documentos reais a clientes como teste.

## Verificação local

`node --test services/whatsapp-bridge/server.test.mjs`

`node node_modules/typescript/bin/tsc --noEmit`

Os testes do adaptador usam Evolution simulada. Não comprovam compatibilidade da versão instalada, pareamento nem entrega real. A ativação depende da migração, instalação do adaptador, URL/segredo e leitura do QR code pelo responsável.

## Operação

Consultar `whatsapp_sends` pelo backend/admin para estados `pending`, `accepted` e `unknown`. Não guarda PDF nem número do destinatário. `accepted` significa aceito pelo provedor, não entregue/lido. Solicitações pendentes após interrupção do processo também exigem conferência manual antes de novo envio. Desligar o módulo impede novos envios; uma transmissão já iniciada pode terminar. Para rollback, desligar a chave e parar somente o adaptador MB Garage; preservar tabelas de auditoria e os serviços compartilhados.
