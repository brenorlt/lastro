"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  type Consent,
  flushPendingEvents,
  GA_MEASUREMENT_ID,
  readConsent,
  saveConsent,
  setAnalyticsUser,
  subscribeConsent,
  trackPageView,
} from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth-store";

function useConsent(): Consent | null | undefined {
  // undefined no servidor: nada de banner nem script até saber a escolha salva.
  return useSyncExternalStore(subscribeConsent, readConsent, () => undefined);
}

/** Uma page_view por troca de rota (o App Router navega sem recarregar a página). */
function PageViews() {
  const pathname = usePathname();
  const lastTitle = useRef<string | null>(null);
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    // Mesma rota de novo (efeito duplo do StrictMode): não conta outra visualização.
    if (lastPath.current === pathname) return;
    // O <title> da nova rota chega depois da navegação: espera ele mudar (máx. 1s).
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      lastTitle.current = document.title;
      lastPath.current = pathname;
      trackPageView(pathname);
    };
    const observer = new MutationObserver(() => {
      if (document.title && document.title !== lastTitle.current) send();
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    const timeout = window.setTimeout(send, 1000);
    if (lastTitle.current === null && document.title) send();
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [pathname]);
  return null;
}

function UserId() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => setAnalyticsUser(userId), [userId]);
  return null;
}

/** Renderizado depois dos <Script>: o efeito roda quando o window.gtag do ga-init já existe. */
function PendingEvents() {
  useEffect(() => flushPendingEvents(), []);
  return null;
}

function ConsentBanner() {
  return (
    <div
      role="dialog"
      aria-label="Cookies de análise"
      className="follows-site-theme text-ink bg-surface ring-line animate-rise fixed inset-x-4 bottom-24 z-50 rounded-xl p-4 shadow-lg ring-1 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-sm"
    >
      <p className="text-ink text-sm font-medium">Podemos medir como você usa o Lastro?</p>
      <p className="text-ink-2 mt-1 text-xs">
        Usamos o Google Analytics só para saber quais telas e recursos são usados. Nenhum valor, lançamento ou dado
        pessoal é enviado.{" "}
        <Link href="/privacidade" className="text-accent underline-offset-4 hover:underline">
          Saiba mais
        </Link>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          onClick={() => saveConsent("denied")}
        >
          Recusar
        </button>
        <button type="button" className={buttonVariants({ size: "sm" })} onClick={() => saveConsent("granted")}>
          Aceitar
        </button>
      </div>
    </div>
  );
}

/**
 * GA4 só com consentimento: sem aceite o script do Google nem é baixado. page_view é enviado
 * manualmente (send_page_view: false) para usar a rota sanitizada, sem ids nem query string.
 */
export function GoogleAnalytics() {
  const consent = useConsent();
  if (!GA_MEASUREMENT_ID || consent === undefined) return null;
  if (consent === null) return <ConsentBanner />;
  if (consent === "denied") return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('js',new Date());
gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
      <PageViews />
      <UserId />
      <PendingEvents />
    </>
  );
}
