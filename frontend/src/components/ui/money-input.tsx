"use client";

import { forwardRef, useState, type ChangeEvent, type FocusEvent } from "react";
import { cn } from "@/lib/cn";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
import { Input, type InputProps } from "./input";

interface MoneyInputProps extends Omit<InputProps, "value" | "onChange" | "type" | "leading"> {
  /** Decimal em string ("1234.56") ou "" quando vazio. */
  value: string;
  onChange: (value: string) => void;
  currencySymbol?: string;
  allowNegative?: boolean;
}

/**
 * Campo monetário: a pessoa digita em pt-BR ("1.234,56"); o formulário recebe
 * o decimal normalizado ("1234.56"). Ao sair do campo, formata com milhar e centavos.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, currencySymbol = "R$", allowNegative = false, className, onBlur, ...props }, ref) => {
    const [text, setText] = useState(() => formatMoneyInput(value));
    const [lastValue, setLastValue] = useState(value);

    // Sincroniza quando o valor muda de fora (reset do formulário, edição de outro item).
    if (value !== lastValue) {
      setLastValue(value);
      if (parseMoneyInput(text) !== value) setText(formatMoneyInput(value));
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const allowed = allowNegative ? /[^\d.,\-−]/g : /[^\d.,]/g;
      const next = e.target.value.replace(allowed, "");
      setText(next);
      const parsed = parseMoneyInput(next);
      const normalized = parsed ?? (next === "" ? "" : "invalid");
      setLastValue(normalized);
      onChange(normalized);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      const parsed = parseMoneyInput(text);
      if (parsed !== null) setText(formatMoneyInput(parsed));
      onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        leading={<span className="text-xs font-medium">{currencySymbol}</span>}
        className={cn("num", className)}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";
