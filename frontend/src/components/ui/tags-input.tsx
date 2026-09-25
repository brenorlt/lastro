"use client";

import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { fieldControl } from "./input";

interface TagsInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  max?: number;
  id?: string;
  "aria-describedby"?: string;
}

/** Tags livres: Enter ou vírgula adiciona; Backspace no campo vazio remove a última. */
export function TagsInput({ value, onChange, suggestions = [], max = 10, id, ...aria }: TagsInputProps) {
  const [text, setText] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").slice(0, 30);
    if (!tag || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return setText("");
    onChange([...value, tag]);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const available = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className={cn(fieldControl, "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent")}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-sunken pl-2.5 pr-1 text-xs text-ink">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} className="flex size-4 items-center justify-center rounded-full text-ink-3 hover:bg-line hover:text-ink" aria-label={`Remover tag ${tag}`}>
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        {...aria}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(text)}
        list={available.length ? listId : undefined}
        placeholder={value.length ? "" : "Ex.: viagem, trabalho"}
        disabled={value.length >= max}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
      />
      {available.length > 0 && (
        <datalist id={listId}>
          {available.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}
