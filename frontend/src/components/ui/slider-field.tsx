"use client";

import { Slider } from "radix-ui";
import { useId } from "react";

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  hint?: string;
}

/** Controle deslizante com valor legível ao lado. Teclado: setas ajustam o passo, PgUp/PgDn 10×. */
export function SliderField({ label, value, onChange, min, max, step = 0.5, format = (v) => `${v.toLocaleString("pt-BR")}%`, hint }: SliderFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label id={id} className="text-sm text-ink">{label}</label>
        <span className="num text-sm font-semibold text-ink">{format(value)}</span>
      </div>
      <Slider.Root
        aria-labelledby={id}
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[value]}
        onValueChange={([v]) => v !== undefined && onChange(v)}
        min={min}
        max={max}
        step={step}
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-sunken">
          <Slider.Range className="absolute h-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb
          aria-valuetext={format(value)}
          className="block size-5 rounded-full bg-surface shadow-md ring-1 ring-line-strong transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </Slider.Root>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
