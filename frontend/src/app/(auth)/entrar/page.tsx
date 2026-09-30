import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { GOOGLE_LOGIN_ERRORS } from "@/features/auth/components/google-sign-in";
import { LoginForm } from "@/features/auth/components/login-form";
import { one, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  "senha-redefinida": "Senha redefinida. Por segurança, encerramos as outras sessões — entre com a nova senha.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notice = NOTICES[one(params.aviso) ?? ""];
  const error = GOOGLE_LOGIN_ERRORS[one(params.erro) ?? ""];
  return (
    <>
      <AuthHeading title="Bem-vindo de volta" description="Entre para ver sua visão financeira." />
      <LoginForm next={one(params.next) ?? undefined} notice={notice} error={error} />
    </>
  );
}
