import { CreditCard } from "lucide-react";
import { EntityIcon } from "@/components/ui/entity-icon";
import { cn } from "@/lib/cn";
import { bankLogoSrc, findBank, type Bank } from "@/lib/banks";

const sizes = { sm: "size-8 rounded-sm", md: "size-10 rounded-md", lg: "size-12 rounded-lg" };

/**
 * Logo oficial do banco sobre ladrilho branco — as marcas são desenhadas para fundo
 * claro, então o ladrilho fica branco também no tema escuro (como ícone de app).
 */
export function BankLogo({ bank, size = "md", className }: { bank: Bank; size?: keyof typeof sizes; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/5 ring-inset", sizes[size], className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático local, sem ganho com next/image */}
      <img src={bankLogoSrc(bank)} alt="" className={cn("object-contain", bank.bleed ? "size-full" : "size-[72%]")} loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

/** Ícone de conta: logo do banco quando a instituição é reconhecida, senão o ícone escolhido. */
export function AccountIcon({ account, size, className }: {
  account: { institution?: string | null; icon: string; color: string };
  size?: keyof typeof sizes;
  className?: string;
}) {
  const bank = findBank(account.institution);
  return bank ? <BankLogo bank={bank} size={size} className={className} /> : <EntityIcon icon={account.icon} color={account.color} size={size} className={className} />;
}

/** Ícone compacto de cartão: logo do banco emissor quando reconhecido, senão a cor do cartão. */
export function CardIcon({ card, className }: { card: { institution?: string | null; color: string }; className?: string }) {
  const bank = findBank(card.institution);
  if (bank) return <BankLogo bank={bank} className={cn("size-6 rounded-[6px]", className)} />;
  return (
    <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-[6px] text-white [&_svg]:size-3.5", className)} style={{ background: card.color }}>
      <CreditCard />
    </span>
  );
}
