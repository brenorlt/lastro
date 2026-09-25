import type { Metadata } from "next";
import { VerifyEmail } from "@/features/auth/components/verify-email";
import { one, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Confirmar e-mail", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  return <VerifyEmail token={one(token)} />;
}
