import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading title="Crie sua conta" description="Em poucos minutos você terá sua primeira visão patrimonial." />
      <RegisterForm />
    </>
  );
}
