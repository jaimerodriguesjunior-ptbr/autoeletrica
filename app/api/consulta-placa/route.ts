import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { placa } = await request.json();

  // 1. LIMPEZA DA PLACA
  const cleanPlaca = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // 2. MODO DE TESTE (MOCK)
  // Enquanto você não tem a API Key, use a placa TESTE000 para ver funcionando
  if (cleanPlaca === 'TESTE000' || cleanPlaca === 'MOCK1234') {
    return NextResponse.json({
      success: true,
      data: {
        fabricante: 'VOLKSWAGEN',
        modelo: 'GOL 1.6 POWER',
        ano: '2012',
        cor: 'PRETA',
        extra: 'Dados simulados para teste'
      }
    });
  }

  // 3. INTEGRAÇÃO REAL (Exemplo com API Brasil)
  // Quando tiver a chave, descomente e preencha abaixo:
  /*
  try {
    const token = 'SEU_TOKEN_AQUI'; 
    const url = `https://gateway.apibrasil.com.br/api/v2/vehicles/${cleanPlaca}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!data || data.error) throw new Error("Veículo não encontrado");

    return NextResponse.json({
      success: true,
      data: {
        fabricante: data.brand,
        modelo: data.model,
        ano: data.model_year,
        cor: data.color
      }
    });
  } catch (error) {
    console.error("Erro na API externa:", error);
    // Não retorna erro 500 para o front não travar, apenas avisa que não achou
    return NextResponse.json({ success: false });
  }
  */

  // Por padrão, se não for teste e não tiver API configurada:
  return NextResponse.json({ success: false });
}