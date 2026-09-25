import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { ResetPasswordForm } from "@/features/auth/components/password-recovery-forms";
import { one, type SearchParams } from "../search-params";

export const metadata: Metadata = { title: "Redefinir senha", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  return (
    <>
      <AuthHeading
        title="Defina uma nova senha"
        description="Ao salvar, todas as sessões abertas serão encerradas por segurança."
      />
      <ResetPasswordForm token={one(token)} />
    </>
  );
}
