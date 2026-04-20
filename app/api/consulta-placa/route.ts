import { NextResponse } from 'next/server';

const pickFirstNonEmpty = (...values: unknown[]): string => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

export async function POST(request: Request) {
  try {
    const { placa } = await request.json();
    const cleanPlaca = String(placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    console.log(`[consulta-placa] Iniciando consulta para placa ${cleanPlaca}`);

    if (!cleanPlaca || cleanPlaca.length < 6) {
      console.warn(`[consulta-placa] Placa invalida recebida: ${placa}`);
      return NextResponse.json({ success: false, error: 'Placa invalida' }, { status: 400 });
    }

    // Modo de teste local para validar UX sem depender da API externa.
    if (cleanPlaca === 'TESTE000' || cleanPlaca === 'MOCK1234') {
      return NextResponse.json({
        success: true,
        data: {
          fabricante: 'VOLKSWAGEN',
          modelo: 'GOL 1.6 POWER',
          ano: '2012',
          cor: 'PRETA',
          extra: 'Dados simulados para teste',
        },
      });
    }

    const token = process.env.APIPLACAS_TOKEN;
    if (!token) {
      console.warn('[consulta-placa] APIPLACAS_TOKEN nao configurado');
      return NextResponse.json({ success: false });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const url = `https://wdapi2.com.br/consulta/${encodeURIComponent(cleanPlaca)}/${encodeURIComponent(token)}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn(`[consulta-placa] Falha HTTP ${response.status} para placa ${cleanPlaca}`);
        return NextResponse.json({ success: false });
      }

      const raw = await response.json();
      const normalizedRaw =
        typeof raw === 'string'
          ? (() => {
              try {
                return JSON.parse(raw);
              } catch {
                return {};
              }
            })()
          : raw;
      const data =
        typeof normalizedRaw?.data === 'object' && normalizedRaw?.data !== null
          ? normalizedRaw.data
          : normalizedRaw;

      const fipeTop = Array.isArray(data?.fipe?.dados) ? data.fipe.dados[0] : null;
      const fabricante = pickFirstNonEmpty(
        data?.marca,
        data?.fabricante,
        data?.MARCA,
        data?.FABRICANTE,
        fipeTop?.texto_marca
      );
      const modelo = pickFirstNonEmpty(
        data?.modelo,
        data?.MODELO,
        data?.marcaModelo,
        data?.extra?.modelo,
        fipeTop?.texto_modelo,
        Array.isArray(data?.listamodelo) ? data.listamodelo.join(' ') : ''
      );
      const ano = pickFirstNonEmpty(
        data?.anoModelo,
        data?.ano_modelo,
        data?.ano,
        data?.ANO,
        data?.model_year,
        data?.extra?.ano_modelo,
        fipeTop?.ano_modelo
      );
      const cor = pickFirstNonEmpty(data?.cor, data?.COR, data?.extra?.cor);

      console.log(
        `[consulta-placa] Resultado ${cleanPlaca} | fabricante="${fabricante}" modelo="${modelo}" ano="${ano}" cor="${cor}"`
      );

      if (!fabricante && !modelo && !ano) {
        console.warn(`[consulta-placa] Sem dados uteis para placa ${cleanPlaca}`);
        return NextResponse.json({ success: false });
      }

      return NextResponse.json({
        success: true,
        data: {
          fabricante,
          modelo,
          ano,
          cor,
          raw: data,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('[consulta-placa] Erro ao consultar placa:', error);
    return NextResponse.json({ success: false });
  }
}
