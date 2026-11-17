import { ArrowDown } from "lucide-react";

/**
 * Frases na voz de quem ainda não tem clareza (não são depoimentos de clientes):
 * o vocabulário de quem compra converte mais do que o do marketing.
 */
const THOUGHTS = [
  { quote: "Eu tinha uma planilha. Durou até março.", tag: "Planilha abandonada" },
  { quote: "Sei quanto ganho. Não faço ideia de quanto gasto.", tag: "Dinheiro sem rastro" },
  { quote: "A fatura sempre vem maior do que eu esperava.", tag: "Cartão no escuro" },
  { quote: "Tenho dinheiro em quatro lugares e não sei quanto tenho no total.", tag: "Patrimônio espalhado" },
  { quote: "Quero viajar, trocar de carro… mas quanto eu guardo por mês?", tag: "Metas sem número" },
  { quote: "Se eu perder o emprego amanhã, aguento quantos meses?", tag: "Sem reserva" },
];

export function ProblemSection() {
  return (
    <section id="problema" data-section="problema" className="defer-render scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="text-ink-3 text-xs font-medium tracking-[0.16em] uppercase">Soa familiar?</p>
          <h2 className="font-display text-ink mt-3 text-3xl leading-[1.1] tracking-[-0.02em] sm:text-[2.75rem]">
            O salário cai, os boletos chegam e no dia 20 fica a pergunta:{" "}
            <span className="text-ink-2 italic">para onde foi o dinheiro?</span>
          </h2>
          <p className="text-ink-2 mt-5 sm:text-lg">
            Não é falta de disciplina. É falta de uma visão que junte tudo. Se você já pensou alguma destas, o Lastro
            foi feito para você.
          </p>
        </div>

        <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THOUGHTS.map((t) => (
            <li
              key={t.tag}
              className="reveal bg-surface ring-line group relative flex flex-col justify-between gap-6 rounded-2xl p-6 ring-1 transition-shadow hover:shadow-md"
            >
              <blockquote className="font-display text-ink text-xl leading-snug tracking-[-0.01em]">
                “{t.quote}”
              </blockquote>
              <span className="text-ink-3 text-2xs font-medium tracking-[0.12em] uppercase">{t.tag}</span>
            </li>
          ))}
        </ul>

        <p className="reveal text-ink-2 mt-12 flex items-center justify-center gap-2 text-center text-sm">
          <ArrowDown className="text-brass size-4" aria-hidden />
          Cada uma dessas frases tem uma tela no Lastro que resolve.
        </p>
      </div>
    </section>
  );
}
