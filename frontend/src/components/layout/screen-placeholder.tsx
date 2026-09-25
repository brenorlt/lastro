import { Construction } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { getRoute, type RouteKey } from "@/config/navigation";
import { PageHeader } from "./page-header";

/**
 * Tela estrutural: rota, título, propósito e navegação já existem;
 * a funcionalidade chega na fase indicada do roadmap.
 */
export function ScreenPlaceholder({ route }: { route: RouteKey }) {
  const r = getRoute(route);
  return (
    <>
      <PageHeader
        title={r.label}
        description={r.purpose}
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: r.label }]}
        actions={<Badge tone="outline">Fase {r.phase}</Badge>}
      />
      <Card>
        <EmptyState
          icon={r.icon ?? Construction}
          title="Estrutura pronta"
          description={`A navegação, o layout e os componentes desta tela já seguem o Design System. A funcionalidade completa será implementada na Fase ${r.phase}.`}
          action={
            <Link href="/design-system" className={buttonVariants({ variant: "secondary" })}>
              Ver Design System
            </Link>
          }
        />
      </Card>
    </>
  );
}
