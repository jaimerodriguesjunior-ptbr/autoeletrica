"use server";

import { emitirNFeDevolucao, emitirNFeRemessaConsertoAction, emitirNFeRemessaGarantiaAction, emitirNFeRetornoConsertoAction, emitirNFeRetornoGarantiaAction, emitirNFeVenda } from "@/src/actions/fiscal_emission";

export async function emitirNFeVendaAction(payload: Parameters<typeof emitirNFeVenda>[0]) {
    return emitirNFeVenda(payload);
}

export async function emitirNFeDevolucaoAction(payload: Parameters<typeof emitirNFeDevolucao>[0]) {
    return emitirNFeDevolucao(payload);
}

export async function emitirNFeRemessaConsertoUiAction(payload: Parameters<typeof emitirNFeRemessaConsertoAction>[0]) {
    return emitirNFeRemessaConsertoAction(payload);
}

export async function emitirNFeRemessaGarantiaUiAction(payload: Parameters<typeof emitirNFeRemessaGarantiaAction>[0]) {
    return emitirNFeRemessaGarantiaAction(payload);
}

export async function emitirNFeRetornoConsertoUiAction(payload: Parameters<typeof emitirNFeRetornoConsertoAction>[0]) {
    return emitirNFeRetornoConsertoAction(payload);
}

export async function emitirNFeRetornoGarantiaUiAction(payload: Parameters<typeof emitirNFeRetornoGarantiaAction>[0]) {
    return emitirNFeRetornoGarantiaAction(payload);
}
