"use client";

/**
 * Interface para os dados unificados de catálogo.
 */
export interface CosmosProduct {
  description: string;
  gtin: number | string;
  thumbnail?: string;
  price?: string;
  brand?: {
    name: string;
    picture?: string;
  } | string;
  ncm?: {
    code: string;
    description: string;
  };
}

export function normalizeBarcode(value: string): string {
  return value.replace(/\D/g, "").trim();
}

/**
 * Busca dados no Bluesoft Cosmos (Brasil)
 */
async function fetchFromCosmos(ean: string): Promise<CosmosProduct | null> {
  try {
    const response = await fetch(`/api/cosmos/${ean}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar no Cosmos:", error);
    return null;
  }
}

/**
 * Busca dados no UPCItemDB (Internacional)
 */
async function fetchFromUPCItemDB(ean: string): Promise<CosmosProduct | null> {
  // Para UPCItemDB, às vezes é melhor remover o zero à esquerda se for UPC-A.
  const upc = ean.length === 13 && ean.startsWith("0") ? ean.slice(1) : ean;

  try {
    const response = await fetch(`/api/upcitemdb/${upc}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) return null;
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        description: item.title,
        gtin: item.upc || item.ean || ean,
        thumbnail: item.images && item.images.length > 0 ? item.images[0] : undefined,
        brand: { name: item.brand || "" }
      };
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar no UPCItemDB:", error);
    return null;
  }
}

/**
 * Busca dados unificada. Tenta Cosmos primeiro, depois UPCItemDB.
 */
export async function fetchProductFromCosmos(ean: string): Promise<CosmosProduct | null> {
  const cleanEan = normalizeBarcode(ean);
  if (cleanEan.length < 8) return null;

  console.log(`Buscando ${cleanEan} no Cosmos...`);
  const cosmosResult = await fetchFromCosmos(cleanEan);
  if (cosmosResult) return cosmosResult;

  console.log(`Não encontrado no Cosmos. Buscando ${cleanEan} no UPCItemDB...`);
  const upcResult = await fetchFromUPCItemDB(cleanEan);
  if (upcResult) return upcResult;

  return null;
}
