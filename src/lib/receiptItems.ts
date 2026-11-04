export type ReceiptItem = {
  id: string | number;
  name: string;
  tipo: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  peca_cliente: boolean | null;
};

export function receiptMoney(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
  });
}

export function receiptItemText(item: ReceiptItem) {
  const tipo = item.tipo === "peca" ? "Produto" : item.tipo === "servico" ? "Serviço" : "Item";
  const quantidade = Number(item.quantity || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  if (item.peca_cliente) return `${tipo}: ${item.name} — ${quantidade}x (fornecido pelo cliente)`;
  return `${tipo}: ${item.name} — ${quantidade}x ${receiptMoney(item.unit_price)} = ${receiptMoney(item.total_price)}`;
}
