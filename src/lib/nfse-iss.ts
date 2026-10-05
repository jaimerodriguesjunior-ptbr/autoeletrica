export type NfseProviderConfig = {
  provedor?: unknown;
  nacional?: {
    opcao_simples_nacional?: unknown;
    regime_apuracao_simples?: unknown;
    tributacao_issqn?: unknown;
    retencao_issqn?: unknown;
  };
};

type IssPayload = {
  tribISSQN: number;
  tpRetISSQN: number;
  cLocIncid: string;
  pAliq?: number;
  vISSQN?: number;
};

function configuredCode(value: unknown, allowed: string[], label: string): string {
  const code = String(value ?? "").trim();
  if (!allowed.includes(code)) {
    throw new Error(`Configuração NFS-e Nacional incompleta: revise ${label} na Nuvem Local Fiscal antes de emitir.`);
  }
  return code;
}

/** Mantém o contrato municipal e aplica as regras da DPS ao provedor Nacional. */
export function buildNfseIss(
  config: NfseProviderConfig,
  municipalPayload: IssPayload,
  configuredRate: unknown
): IssPayload {
  if (config.provedor !== "nfse-nacional") return municipalPayload;

  const national = config.nacional ?? {};
  const simpleOption = configuredCode(national.opcao_simples_nacional, ["1", "2", "3"], "a opção pelo Simples Nacional");
  const simpleRegime = simpleOption === "3"
    ? configuredCode(national.regime_apuracao_simples, ["1", "2", "3"], "o regime de apuração do Simples Nacional")
    : "";
  const taxation = configuredCode(national.tributacao_issqn, ["1", "2", "3", "4"], "a tributação do ISS");
  const retention = configuredCode(national.retencao_issqn, ["1", "2", "3"], "a retenção do ISS");
  const result: IssPayload = {
    tribISSQN: Number(taxation),
    tpRetISSQN: Number(retention),
    cLocIncid: municipalPayload.cLocIncid,
  };

  // vISSQN é resultado da NFS-e autorizada, não um campo da DPS Nacional.
  // E0600, E0625 e E0631: MEI e ME/EPP com ISS pelo SN sem retenção
  // não informam pAliq. A ausência desses valores não deve virar ISS zero.
  if (simpleOption === "2" || taxation !== "1" ||
      (simpleOption === "3" && simpleRegime === "1" && retention === "1")) {
    return result;
  }

  const hasRate = configuredRate !== null && configuredRate !== undefined && String(configuredRate).trim() !== "";
  const rate = hasRate ? Number(configuredRate) : NaN;
  const requiresRate = simpleOption === "3" && simpleRegime === "1" && retention !== "1";
  // E0621/E0628: retenção no Simples exige alíquota efetiva informada.
  if (requiresRate && (!Number.isFinite(rate) || rate < 1.8 || rate > 5)) {
    throw new Error("ISS retido no Simples Nacional: cadastre a alíquota efetiva de ISS informada pelo contador (entre 1,8% e 5%) antes de emitir.");
  }
  if (hasRate && (!Number.isFinite(rate) || rate <= 0 || rate > 9.99)) {
    throw new Error("Alíquota de ISS inválida para a NFS-e Nacional. Confira o cadastro com o contador antes de emitir.");
  }
  if (hasRate) result.pAliq = rate;
  return result;
}
