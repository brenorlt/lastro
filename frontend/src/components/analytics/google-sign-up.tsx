"use client";

import { useEffect } from "react";
import { trackGoogleSignUp } from "@/lib/analytics";

/** O callback do Google manda a conta recém-criada para /onboarding?cadastro=google. */
export function GoogleSignUpEvent() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("cadastro") !== "google") return;
    // Tira o marcador antes de contar: recarregar (ou o efeito duplo do StrictMode) não conta de novo.
    url.searchParams.delete("cadastro");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    trackGoogleSignUp();
  }, []);
  return null;
}
