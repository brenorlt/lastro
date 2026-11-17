import { STRIP_BANKS } from "../data";

/**
 * "Funciona com o extrato de": a faixa de compatibilidade. Só CSS (marquee) e <img> lazy —
 * os logos são SVGs estáticos de /public/banks, sem passar pelo bundle.
 */
export function BankStrip() {
  const row = [...STRIP_BANKS, ...STRIP_BANKS];
  return (
    <section data-section="bancos" aria-labelledby="bancos-titulo" className="border-line border-y py-10">
      <p id="bancos-titulo" className="text-ink-3 px-5 text-center text-xs font-medium tracking-[0.16em] uppercase">
        Importe o extrato OFX ou CSV de qualquer banco
      </p>
      <div className="marquee mt-7 overflow-hidden">
        <ul className="marquee-track flex w-max items-center gap-10 pr-10">
          {row.map((b, i) => (
            <li
              key={`${b.id}-${i}`}
              aria-hidden={i >= STRIP_BANKS.length || undefined}
              className="flex shrink-0 items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático: next/image não otimiza SVG e só somaria JS. */}
              <img
                src={`/banks/${b.id}.svg`}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                decoding="async"
                className="size-9 rounded-[10px] object-cover"
              />
              <span className="text-ink-2 text-sm font-medium whitespace-nowrap">{b.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only">Entre eles: {STRIP_BANKS.map((b) => b.name).join(", ")} e outros.</p>
    </section>
  );
}
