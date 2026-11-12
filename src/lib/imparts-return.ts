export const IMPARTS_RETURN_CNPJ = "06151722000476";
export const IMPARTS_RETURN_CFOP = "5411";

export function isImpartsReturnSupplier(cnpj?: string | null) {
    return String(cnpj ?? "").replace(/\D/g, "") === IMPARTS_RETURN_CNPJ;
}
