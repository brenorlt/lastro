import { EyeOff } from "lucide-react";
import { SECURITY_POINTS } from "../data";
import { SectionHeading } from "./section-heading";

export function SecuritySection() {
  return (
    <section
      id="seguranca"
      data-section="seguranca"
      className="defer-render border-line scroll-mt-20 border-y py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Segurança"
              title="Seu banco continua só seu."
              description="O Lastro nunca pede a senha do banco nem se conecta à sua conta. Você decide o que entra — e nós protegemos como isso é guardado e acessado."
            />
            <div className="reveal bg-positive-soft text-ink mt-8 flex items-start gap-3 rounded-xl p-4 text-sm">
              <EyeOff className="text-positive mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                <strong className="font-medium">Modo privacidade:</strong> esconda todos os valores da tela com um toque
                — para abrir o app no metrô ou numa reunião sem expor nada.
              </p>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {SECURITY_POINTS.map((s) => (
              <li key={s.title} className="reveal bg-surface ring-line flex gap-3.5 rounded-2xl p-5 ring-1">
                <span className="bg-positive-soft text-positive flex size-9 shrink-0 items-center justify-center rounded-md">
                  <s.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <h3 className="text-ink text-sm font-medium">{s.title}</h3>
                  <p className="text-ink-2 mt-1 text-sm">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
