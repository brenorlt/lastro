import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Produto", links: [{ label: "Como funciona", href: "/#como-funciona" }, { label: "Segurança", href: "/#seguranca" }, { label: "Planos", href: "/#planos" }] },
  { title: "Conta", links: [{ label: "Entrar", href: "/entrar" }, { label: "Criar conta", href: "/cadastro" }] },
  { title: "Legal", links: [{ label: "Termos de uso", href: "/termos" }, { label: "Política de privacidade", href: "/privacidade" }] },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-line py-14">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-ink-2">Gestão financeira pessoal para quem leva patrimônio a sério.</p>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-ink-3">{c.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-ink-2 hover:text-ink">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Lastro. Todos os direitos reservados.</p>
          <p>O Lastro não é uma instituição financeira, corretora ou consultoria de investimentos.</p>
        </div>
      </div>
    </footer>
  );
}
