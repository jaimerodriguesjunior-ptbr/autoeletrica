// src/lib/nuvemfiscal.ts

export async function getNuvemFiscalToken() {
  // 1. Pega as credenciais do arquivo .env
  const clientId = process.env.NUVEMFISCAL_CLIENT_ID;
  const clientSecret = process.env.NUVEMFISCAL_CLIENT_SECRET;
  const baseUrl = process.env.NUVEMFISCAL_URL;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais da Nuvem Fiscal não encontradas no .env.local");
  }

  // 2. Monta os dados para pedir o token (Formato x-www-form-urlencoded)
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'empresa'); // Permissão para gerenciar empresas

  try {
    // 3. Faz a chamada para a API
    const response = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erro ao autenticar:", errorData);
      throw new Error(`Falha na autenticação: ${response.statusText}`);
    }

    const data = await response.json();
    // Retorna o token de acesso (ex: "eyJhbGciOiJIUzI1Ni...")
    return data.access_token;

  } catch (error) {
    console.error("Erro na conexão com Nuvem Fiscal:", error);
    throw error;
  }
}