// src/lib/nuvemfiscal.ts

type CachedToken = {
  token: string;
  expiresAt: number;
};

const TOKEN_EXPIRY_SAFETY_MS = 60_000;
const OFFICIAL_AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const tokenCache: Record<string, CachedToken | undefined> = {};
const tokenRequests: Record<string, Promise<string> | undefined> = {};

function resolveAuthUrl(environment: 'production' | 'homologation') {
  const explicitAuthUrl = environment === 'production'
    ? process.env.NUVEMFISCAL_PROD_AUTH_URL
    : process.env.NUVEMFISCAL_HOM_AUTH_URL;

  return (explicitAuthUrl || OFFICIAL_AUTH_URL).replace(/\/$/, '');
}

export async function getNuvemFiscalToken(
  environment: 'production' | 'homologation' = 'production',
  scope = 'empresa nfce nfe nfse'
) {
  const cacheKey = `${environment}:${scope}`;
  const now = Date.now();
  const cached = tokenCache[cacheKey];

  if (cached && cached.expiresAt > now + TOKEN_EXPIRY_SAFETY_MS) {
    console.log(`[NuvemFiscal] Utilizando token cacheado para ${environment.toUpperCase()}.`);
    return cached.token;
  }

  if (tokenRequests[cacheKey]) {
    console.log(`[NuvemFiscal] Aguardando token em andamento para ${environment.toUpperCase()}.`);
    return tokenRequests[cacheKey]!;
  }

  tokenRequests[cacheKey] = fetchNuvemFiscalToken(environment, scope, cacheKey);

  try {
    return await tokenRequests[cacheKey]!;
  } finally {
    delete tokenRequests[cacheKey];
  }
}

async function fetchNuvemFiscalToken(
  environment: 'production' | 'homologation',
  scope: string,
  cacheKey: string
) {
  // 1. Pega as credenciais do arquivo .env baseado no ambiente
  let clientId, clientSecret;

  if (environment === 'production') {
    clientId = process.env.NUVEMFISCAL_PROD_CLIENT_ID;
    clientSecret = process.env.NUVEMFISCAL_PROD_CLIENT_SECRET;
  } else {
    clientId = process.env.NUVEMFISCAL_HOM_CLIENT_ID;
    clientSecret = process.env.NUVEMFISCAL_HOM_CLIENT_SECRET;
  }

  const authUrl = resolveAuthUrl(environment);

  console.log(`[NuvemFiscal] Tentando autenticar em ${environment.toUpperCase()}...`);
  // console.log('[NuvemFiscal] Client ID:', clientId);
  console.log('[NuvemFiscal] Auth URL:', authUrl);

  if (!clientId || !clientSecret) {
    throw new Error(`Credenciais da Nuvem Fiscal (${environment}) não encontradas no .env.local`);
  }

  // 2. Monta os dados para pedir o token (Formato x-www-form-urlencoded)
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', scope); // Permissao solicitada para a chamada atual

  try {
    // 3. Faz a chamada para a API de Autenticação
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    console.log('[NuvemFiscal] Status da resposta:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NuvemFiscal] Erro ao autenticar (Status: ${response.status}):`, errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }

      throw new Error(`Falha na autenticação (${response.status}): ${errorData.error_description || errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('[NuvemFiscal] Token obtido com sucesso!');
    const expiresInSeconds = Number(data.expires_in || 3600);
    tokenCache[cacheKey] = {
      token: data.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };

    return data.access_token;

  } catch (error) {
    console.error("[NuvemFiscal] Erro na conexão com Nuvem Fiscal:", error);
    throw error;
  }
}
