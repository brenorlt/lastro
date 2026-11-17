import type { Metadata } from "next";
import { SessionGate } from "@/features/auth/components/session-gate";
import { AUTHORIZE_KEYS, type AuthorizeParams } from "@/features/connect/api";
import { ConsentView } from "@/features/connect/components/consent-view";
import { one, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Conectar app", robots: { index: false, follow: false } };

/** Destino do /api/oauth/authorize: a pessoa (logada) aprova ou recusa o acesso do app. */
export default async function ConnectPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params: AuthorizeParams = {};
  for (const key of AUTHORIZE_KEYS) {
    const v = one(raw[key]);
    if (v) params[key] = v;
  }
  const error = one(raw.erro) ?? (params.client_id ? null : "Link de conexão incompleto.");
  return (
    <SessionGate>
      <ConsentView params={params} error={error} />
    </SessionGate>
  );
}
