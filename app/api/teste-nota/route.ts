import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

export async function GET() {
  try {
    const token = await getNuvemFiscalToken();
    return NextResponse.json({
      sucesso: true,
      mensagem: "CONECTADO! Temos um token válido.",
      token_recebido: token.slice(0, 20) + "..."
    });
  } catch (error) {
    return NextResponse.json({ sucesso: false, erro: "Falha ao conectar" }, { status: 500 });
  }
}