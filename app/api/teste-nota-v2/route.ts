import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const token = await getNuvemFiscalToken();

        // Payload de teste para NFS-e (Guaíra/PR)
        const payload = {
            "ambiente": "homologacao",
            "infDPS": {
                "dhEmi": new Date().toISOString(),
                "dCompet": new Date().toISOString().split('T')[0],
                "prest": {
                    "CNPJ": "35181069000143" // CNPJ correto da empresa
                },
                "toma": {
                    "CNPJ": "35181069000143", // Tomador = Prestador para teste
                    "xNome": "TOMADOR TESTE",
                    "end": {
                        "xLgr": "RUA TESTE",
                        "nro": "123",
                        "xBairro": "CENTRO",
                        "endNac": {
                            "cMun": "4108809",
                            "CEP": "85980000"
                        }
                    }
                },
                "serv": {
                    "cServ": {
                        "cTribNac": "1401",
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

        console.log("Enviando DPS de teste v2:", JSON.stringify(payload, null, 2));

        // Debug: Write payload to file using absolute path
        const debugPath = path.join(process.cwd(), 'debug_payload_v2.json');
        fs.writeFileSync(debugPath, JSON.stringify(payload, null, 2));

        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/nfse/dps`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("Resposta DPS v2:", JSON.stringify(result, null, 2));

        const debugResponsePath = path.join(process.cwd(), 'debug_response_v2.json');
        fs.writeFileSync(debugResponsePath, JSON.stringify(result, null, 2));

        return NextResponse.json({
            status: response.status,
            sucesso: response.ok,
            resposta: result
        });

    } catch (error: any) {
        console.error("Erro no teste v2:", error);
        return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
    }
}
