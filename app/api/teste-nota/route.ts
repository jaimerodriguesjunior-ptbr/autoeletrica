import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

export async function GET() {
  try {
    const token = await getNuvemFiscalToken();
    // Em produção, pegar o CNPJ do banco ou do usuário logado.
    // Aqui estamos hardcoded para teste conforme solicitado.
    const cnpj = "35181069000143";

    // Payload de teste para NFS-e (Guaíra/PR)
    const payload = {
      "ambiente": "homologacao",
      "infDPS": {
        "dhEmi": new Date().toISOString(),
        "dCompet": new Date().toISOString().split('T')[0],
        "prest": {
          "CNPJ": cnpj
        },
        "toma": {
          "CNPJ": cnpj, // Tomador = Prestador para teste
          "xNome": "TOMADOR TESTE",
          "end": {
            "xLgr": "RUA TESTE",
            "nro": "123",
            "xBairro": "CENTRO",
            "endNac": {
              "cMun": "4108809", // Guaíra/PR
              "CEP": "85980000"
            }
          }
        },
        "serv": {
          "cServ": {
            "cTribNac": "1401", // Código de serviço nacional (Manutenção)
            "xDescServ": "Serviço de teste de emissão"
          }
        },
        "valores": {
          "vServPrest": {
            "vServ": 10.00
          },
          "trib": {
            "tribMun": {
              "tribISSQN": 1, // 1 - Operação tributável
              "tpRetISSQN": 2, // 2 - Não Retido (Simples Nacional)
              "pAliq": 0,
              "vISSQN": 0
            }
          }
        }
      }
    };

    console.log("Enviando DPS de teste:", JSON.stringify(payload, null, 2));

    const response = await fetch(`${process.env.NUVEMFISCAL_URL}/nfse/dps`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("Resposta DPS:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      status: response.status,
      sucesso: response.ok,
      resposta: result
    });

  } catch (error: any) {
    console.error("Erro no teste:", error);
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }
}