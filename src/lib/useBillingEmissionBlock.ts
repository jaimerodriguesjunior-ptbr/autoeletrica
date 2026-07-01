"use client";

import { useEffect, useState } from "react";

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
        const response = await fetch("/api/cobranca/guard", {
          method: "GET",
          cache: "no-store"
        });

        const data = await response.json().catch(() => null);

        if (!active) return;

        if (response.status === 403 || data?.blocked) {
          setState({
            isLoading: false,
            isBlocked: true,
            message:
              data?.message ||
              data?.error ||
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
          isBlocked: false,
          message: null
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
