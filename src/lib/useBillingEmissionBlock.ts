"use client";

import { useEffect, useState } from "react";

import { getBillingAuthHeaders } from "@/src/lib/cobrancaGuardClient";

type BillingEmissionBlockState = {
  isLoading: boolean;
  isBlocked: boolean;
  message: string | null;
};

export function useBillingEmissionBlock() {
  const [state, setState] = useState<BillingEmissionBlockState>({
    isLoading: true,
    isBlocked: false,
    message: null
  });

  useEffect(() => {
    let active = true;

    async function loadBillingStatus() {
      try {
        const authHeaders = await getBillingAuthHeaders();
        const response = await fetch("/api/cobranca/guard", {
          method: "GET",
          cache: "no-store",
          headers: authHeaders
        });

        const data = await response.json().catch(() => null);

        if (!active) return;

        if (!response.ok || data?.blocked) {
          setState({
            isLoading: false,
            isBlocked: true,
            message:
              data?.message ||
              data?.error ||
              (response.status >= 500
                ? "Nao foi possivel validar a cobranca agora. Emissoes fiscais bloqueadas por seguranca."
                : null) ||
              "Emissoes fiscais temporariamente bloqueadas para esta loja."
          });
          return;
        }

        setState({
          isLoading: false,
          isBlocked: false,
          message: null
        });
      } catch {
        if (!active) return;

        setState({
          isLoading: false,
          isBlocked: true,
          message:
            "Nao foi possivel validar a cobranca agora. Emissoes fiscais bloqueadas por seguranca."
        });
      }
    }

    loadBillingStatus();

    return () => {
      active = false;
    };
  }, []);

  return state;
}
