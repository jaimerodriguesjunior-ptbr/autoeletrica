import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: { upc: string } }
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const upc = params.upc;

  if (!/^\d{8,14}$/.test(upc)) {
    return NextResponse.json({ error: 'UPC inválido.' }, { status: 400 });
  }

  try {
    // UPCItemDB Explorer/Trial API (100 requests/day, no key needed)
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AutoEletrica-Inventory-Service"
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro na API UPCItemDB: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro no Proxy UPCItemDB:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar no UPCItemDB" },
      { status: 500 }
    );
  }
}
