"use client";

import { Check } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { forwardRef, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { findBank, searchBanks } from "@/lib/banks";
import { cn } from "@/lib/cn";
import { BankLogo } from "./bank-logo";

interface InstitutionInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Campo livre de banco/instituição com sugestões dos bancos que o app reconhece
 * (combobox ARIA: o foco fica no input, setas navegam, Enter escolhe). Qualquer
 * outro texto continua valendo — só não ganha logo.
 */
export const InstitutionInput = forwardRef<HTMLInputElement, InstitutionInputProps>(
  ({ value, onChange, onBlur, ...props }, ref) => {
    const listId = useId();
    const listRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const matches = searchBanks(value);
    const selected = findBank(value);
    const visible = open && matches.length > 0;

    useEffect(() => {
      if (active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const choose = (name: string) => {
      onChange(name);
      setOpen(false);
      setActive(-1);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!open) return setOpen(true);
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + matches.length) % matches.length);
      } else if (e.key === "Enter" && visible && active >= 0) {
        e.preventDefault();
        choose(matches[active]!.name);
      } else if (e.key === "Escape" && visible) {
        // Fecha só a lista, não o drawer em volta.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };

    return (
      <PopoverPrimitive.Root open={visible} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div>
            <Input
              ref={ref}
              {...props}
              value={value}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={visible}
              aria-controls={listId}
              aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
              autoComplete="off"
              leading={selected ? <BankLogo bank={selected} className="size-5 rounded-[5px]" /> : undefined}
              className={selected ? "pl-10" : undefined}
              onChange={(e) => {
                onChange(e.target.value);
                setOpen(true);
                setActive(-1);
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onBlur={() => {
                setOpen(false);
                onBlur?.();
              }}
              onKeyDown={onKeyDown}
            />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-lg bg-surface-raised p-1 shadow-lg ring-1 ring-line animate-fade-in",
            )}
          >
            <div ref={listRef} id={listId} role="listbox" aria-label="Bancos" className="max-h-[min(16rem,var(--radix-popover-content-available-height))] overflow-y-auto">
              {matches.map((bank, i) => (
                <div
                  key={bank.id}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected?.id === bank.id}
                  // mousedown não tira o foco do input (senão o blur fecharia a lista antes do clique).
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(bank.name)}
                  className={cn(
                    "flex h-10 cursor-default select-none items-center gap-2.5 rounded-sm px-2 text-sm text-ink",
                    i === active && "bg-surface-sunken",
                  )}
                >
                  <BankLogo bank={bank} className="size-6 rounded-[6px]" />
                  <span className="min-w-0 flex-1 truncate">{bank.name}</span>
                  {selected?.id === bank.id && <Check className="size-4 shrink-0 text-accent" aria-hidden />}
                </div>
              ))}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  },
);
InstitutionInput.displayName = "InstitutionInput";
