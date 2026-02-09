import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

export async function GET() {
    try {
        const token = await getNuvemFiscalToken();
        const cnpj = "35181069000143";

        const logs: string[] = [];
        const log = (msg: string) => {
            console.log(msg);
            logs.push(msg);
        };

        log(`Iniciando teste FINAL para CNPJ: ${cnpj}`);

        // 1. Check Config
        log("Verificando configuração...");
        const configResponse = await fetch(`${process.env.NUVEMFISCAL_URL}/empresas/${cnpj}/nfse`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const configResult = await configResponse.json();
        log(`Status Config: ${configResponse.status}`);
        log(`Response Config: ${JSON.stringify(configResult)}`);

        if (!configResponse.ok) {
            return NextResponse.json({
                sucesso: false,
                etapa: "verificacao_config",
                logs,
                erro: configResult
            }, { status: 400 });
        }

        // 2. Emitir DPS
        const payload = {
            "ambiente": "homologacao",
            "infDPS": {
                "dhEmi": new Date().toISOString(),
                "dCompet": new Date().toISOString().split('T')[0],
                "prest": {
                    "CNPJ": cnpj
                },
                "toma": {
                    "CNPJ": cnpj,
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
                            "tribISSQN": 1,
                            "tpRetISSQN": 2,
                            "pAliq": 0,
                            "vISSQN": 0
                        }
                    }
                }
            }
        };

        log("Enviando DPS...");
        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/nfse/dps`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        log(`Status Emissão: ${response.status}`);
        log(`Response Emissão: ${JSON.stringify(result)}`);

        return NextResponse.json({
            status: response.status,
            sucesso: response.ok,
            logs,
            resposta: result
        });

    } catch (error: any) {
        console.error("Erro no teste:", error);
        return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
    }
}
