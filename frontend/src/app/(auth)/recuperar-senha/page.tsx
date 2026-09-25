import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { ForgotPasswordForm } from "@/features/auth/components/password-recovery-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Recuperar senha" description="Informe o e-mail da sua conta e enviaremos um link seguro." />
      <ForgotPasswordForm />
    </>
  );
}
