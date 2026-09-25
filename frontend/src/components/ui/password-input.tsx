"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { Input, type InputProps } from "./input";

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing">>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      {...props}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex size-7 items-center justify-center rounded-sm text-ink-3 hover:text-ink"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      }
    />
  );
});
PasswordInput.displayName = "PasswordInput";
