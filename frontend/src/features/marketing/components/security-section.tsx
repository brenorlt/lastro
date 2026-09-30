import { SECURITY_POINTS } from "../data";

export function SecuritySection() {
  return (
    <section id="seguranca" data-section="seguranca" className="scroll-mt-20 border-y border-line py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Segurança</p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              Dados financeiros pedem o mesmo cuidado de um banco.
            </h2>
            <p className="mt-4 text-ink-2">
              O Lastro nunca se conecta à sua conta bancária. Você controla o que é registrado, e nós protegemos como
              isso é guardado e acessado.
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {SECURITY_POINTS.map((s) => (
              <li key={s.title} className="flex gap-3.5 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-positive-soft text-positive">
                  <s.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-medium text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
