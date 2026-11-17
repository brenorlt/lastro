import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./button-variants";
import { Spinner } from "./spinner";

export { buttonVariants };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <span className="invisible inline-flex items-center gap-2">{children}</span>
            <Spinner className="absolute" label="Processando" />
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

/** Botão só com ícone: exige rótulo acessível e mostra-o como tooltip nativo. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  ({ label, size = "icon", variant = "ghost", ...props }, ref) => (
    <Button ref={ref} size={size} variant={variant} aria-label={label} title={label} {...props} />
  ),
);
IconButton.displayName = "IconButton";
