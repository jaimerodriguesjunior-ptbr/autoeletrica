import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: { ean: string } }
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const ean = params.ean;

  if (!/^\d{8,14}$/.test(ean)) {
    return NextResponse.json({ error: 'EAN inválido.' }, { status: 400 });
  }

  const cosmosToken = process.env.COSMOS_TOKEN;

  if (!cosmosToken) {
    return NextResponse.json(
      { error: "COSMOS_TOKEN não configurado." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${ean}.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Cosmos-Token": cosmosToken,
        "User-Agent": "AutoEletrica-Inventory-Service"
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro na API Cosmos: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro no Proxy Cosmos:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar no Cosmos" },
      { status: 500 }
    );
  }
}
