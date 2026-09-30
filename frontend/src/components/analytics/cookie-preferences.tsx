"use client";

import { GA_MEASUREMENT_ID, saveConsent } from "@/lib/analytics";

/** Reabre o aviso de cookies (apaga a escolha salva). */
export function CookiePreferences() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <button type="button" className="underline" onClick={() => saveConsent(null)}>
      Alterar minha escolha
    </button>
  );
}
