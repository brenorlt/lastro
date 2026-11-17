import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-12" />
      <p className="font-display text-6xl text-ink">404</p>
      <h1 className="mt-4 text-lg font-medium text-ink">Esta página não existe</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-2">O endereço pode ter mudado ou sido digitado incorretamente.</p>
      <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-8" })}>
        Voltar ao início
      </Link>
    </main>
  );
}
