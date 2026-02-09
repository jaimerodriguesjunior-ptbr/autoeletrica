import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getNuvemFiscalToken(environment: 'production' | 'homologation' = 'production') {
    let clientId, clientSecret;

    if (environment === 'production') {
        clientId = process.env.NUVEMFISCAL_PROD_CLIENT_ID;
        clientSecret = process.env.NUVEMFISCAL_PROD_CLIENT_SECRET;
    } else {
        clientId = process.env.NUVEMFISCAL_HOM_CLIENT_ID;
        clientSecret = process.env.NUVEMFISCAL_HOM_CLIENT_SECRET;
    }

    const authUrl = "https://auth.nuvemfiscal.com.br/oauth/token";

    if (!clientId || !clientSecret) {
        throw new Error(`Credenciais da Nuvem Fiscal (${environment}) não encontradas no .env.local`);
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'empresa nfce nfe nfse');

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha na autenticação (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function testEmission() {
    console.log("Iniciando teste de emissão para Guaíra...");

    const { data: settings, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

    if (error || !settings) {
        console.error("Erro ao buscar configurações:", error);
        return;
    }

    const cnpj = settings.cnpj || settings.cpf_cnpj;
    if (!cnpj) {
        console.error("CNPJ não encontrado.");
        return;
    }

    let token;
    try {
        token = await getNuvemFiscalToken('production');
        console.log("Autenticado na Nuvem Fiscal.");
    } catch (e) {
        console.error("Erro na autenticação:", e);
        return;
    }

    // Teste: Provocar inconsistência
    // cSitTrib="0" (TI) mas tribISSQN=3 (Isento)
    // Esperado: Erro [62], [63] ou similar. Se der [60], o "0" não foi reconhecido.
    const testCase = { cSitTrib: "0", desc: "Provocando Inconsistência (TI vs Isento)" };

    console.log(`\n--- Testando: ${testCase.desc} ---`);

    const payload: any = {
        ambiente: "producao",
        infDPS: {
            dhEmi: new Date().toISOString(),
            dCompet: new Date().toISOString().split('T')[0],
            prest: {
                CNPJ: cnpj.replace(/\D/g, '')
            },
            toma: {
                CPF: "58212043134",
                xNome: "JAIME RODRIGUES JUNIOR",
                end: {
                    xLgr: "AV. MATE LARANJEIRA",
                    nro: "424",
                    xBairro: "CENTRO",
                    endNac: {
                        cMun: "4108809",
                        CEP: "85980000"
                    }
                }
            },
            serv: {
                cServ: {
                    cTribNac: "140102",
                    cTribMun: "4520007",
                    CNAE: "4520007",
                    cSitTrib: testCase.cSitTrib,
                    xDescServ: `Teste Debug ${testCase.desc}`
                }
            },
            valores: {
                vServPrest: {
                    vServ: 1.00
                },
                trib: {
                    tribMun: {
                        tribISSQN: 3, // 3 = Isento (Nuvem Fiscal)
                        tpRetISSQN: 2,
                        pAliq: 0,
                        vISSQN: 0
                    }
                }
            }
        }
    };

    try {
        const cleanCnpj = cnpj.replace(/\D/g, '');
        const url = `https://api.nuvemfiscal.com.br/nfse/dps`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`Status Envio: ${response.status}`);

        if (response.status === 200 || response.status === 201) {
            console.log("ID DPS:", data.id);

            if (data.id) {
                console.log("Aguardando 5s para consultar status...");
                await new Promise(r => setTimeout(r, 5000));

                const respConsulta = await fetch(`https://api.nuvemfiscal.com.br/nfse/${data.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const dataConsulta = await respConsulta.json();

                console.log("Status Consulta:", dataConsulta.status);
                if (dataConsulta.mensagens) {
                    const erros = dataConsulta.mensagens.map((m: any) => `${m.codigo}: ${m.descricao}`);
                    console.log("Erros:", erros.join(" | "));
                }
            }
        } else {
            console.log("Erro no Envio:", JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error("Exceção:", err);
    }
}

testEmission();
