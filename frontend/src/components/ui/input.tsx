import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const fieldControl = cn(
  "w-full rounded-md bg-surface text-sm text-ink shadow-xs ring-1 ring-line ring-inset",
  "placeholder:text-ink-3 transition-[box-shadow,background-color] duration-150",
  "hover:ring-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
  "aria-invalid:ring-negative aria-invalid:focus-visible:ring-negative",
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leading, trailing, type = "text", ...props }, ref) => {
    if (!leading && !trailing) {
      return <input ref={ref} type={type} className={cn(fieldControl, "h-10 px-3", className)} {...props} />;
    }
    return (
      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-3 flex text-ink-3 [&_svg]:size-4">{leading}</span>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(fieldControl, "h-10", leading ? "pl-9" : "pl-3", trailing ? "pr-10" : "pr-3", className)}
          {...props}
        />
        {trailing && <span className="absolute right-2 flex items-center text-ink-3">{trailing}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(fieldControl, "min-h-20 resize-y px-3 py-2.5", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
