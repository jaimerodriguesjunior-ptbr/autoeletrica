// src/app/api/teste-nota/route.ts
import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/lib/nuvemfiscal'; // Ajuste o caminho se necessário

export async function GET() {
  try {
    const token = await getNuvemFiscalToken();
    return NextResponse.json({ 
      sucesso: true, 
      mensagem: "CONECTADO! Temos um token válido.",
      token_recebido: token.slice(0, 20) + "..." // Mostra só o começo pra não vazar
    });
  } catch (error) {
    return NextResponse.json({ sucesso: false, erro: "Falha ao conectar" }, { status: 500 });
  }
}