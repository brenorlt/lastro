"use client";

import { Check } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { cn } from "@/lib/cn";
import { ICON_NAMES, ICONS, PICKER_COLORS } from "@/lib/icons";

const COLOR_NAMES: Record<string, string> = {
  "#3F51D8": "Índigo",
  "#0EA5E9": "Céu",
  "#14B8A6": "Verde-água",
  "#16A34A": "Verde",
  "#84CC16": "Lima",
  "#EAB308": "Amarelo",
  "#F97316": "Laranja",
  "#EF4444": "Vermelho",
  "#EC4899": "Rosa",
  "#A855F7": "Roxo",
  "#6366F1": "Violeta",
  "#78716C": "Pedra",
  "#64748B": "Ardósia",
  "#111316": "Grafite",
};

export function ColorPicker({ value, onChange, label = "Cor" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const colors: string[] = [...PICKER_COLORS];
  if (value && !colors.includes(value.toUpperCase())) colors.unshift(value.toUpperCase());
  return (
    <RadioGroup.Root aria-label={label} value={value.toUpperCase()} onValueChange={onChange} className="flex flex-wrap gap-2" loop>
      {colors.map((c) => (
        <RadioGroup.Item
          key={c}
          value={c}
          aria-label={COLOR_NAMES[c] ?? c}
          className="flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface-raised transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:ring-2 data-[state=checked]:ring-ink"
          style={{ background: c }}
        >
          <RadioGroup.Indicator>
            <Check className="size-4 text-white drop-shadow" aria-hidden />
          </RadioGroup.Indicator>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

export function IconPicker({ value, onChange, color, label = "Ícone" }: { value: string; onChange: (v: string) => void; color: string; label?: string }) {
  return (
    <RadioGroup.Root aria-label={label} value={value} onValueChange={onChange} className="grid grid-cols-8 gap-1.5" loop>
      {ICON_NAMES.map((name) => {
        const Icon = ICONS[name];
        return (
          <RadioGroup.Item
            key={name}
            value={name}
            aria-label={name.replace(/-/g, " ")}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-sunken hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "data-[state=checked]:text-ink data-[state=checked]:ring-2 data-[state=checked]:ring-inset",
            )}
            style={value === name ? { background: `color-mix(in oklab, ${color} 16%, transparent)`, ["--tw-ring-color" as string]: color } : undefined}
          >
            <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Escolha única com cartões — para poucas opções com explicação (tipo de conta). */
export function OptionCards<T extends string>({ value, onChange, options, label, columns = 2 }: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  label: string;
  columns?: 2 | 3;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn("grid gap-2", columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}
      loop
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className="rounded-md bg-surface px-3 py-2.5 text-left ring-1 ring-line ring-inset transition-shadow hover:ring-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:bg-accent-soft data-[state=checked]:ring-2 data-[state=checked]:ring-accent"
        >
          <span className="block text-sm font-medium text-ink">{o.label}</span>
          {o.description && <span className="mt-0.5 block text-xs text-ink-3">{o.description}</span>}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** Controle segmentado de escolha única (ex.: Despesa · Receita · Transferência). */
export function SegmentedControl<T extends string>({ value, onChange, options, label, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn("grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-surface-sunken p-0.5", className)}
      loop
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className="h-9 rounded-[7px] px-3 text-sm font-medium text-ink-2 transition-[background-color,color,box-shadow] duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:bg-surface data-[state=checked]:text-ink data-[state=checked]:shadow-sm"
        >
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
