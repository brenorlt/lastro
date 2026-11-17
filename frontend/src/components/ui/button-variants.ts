import { cva } from "class-variance-authority";

/**
 * Classes do botão, sem dependências de runtime além do cva. Separado de button.tsx para que
 * links com cara de botão (landing, header) não arrastem o Radix Slot — e, com ele, o chunk
 * compartilhado do webpack que também carrega toasts e outros primitivos do app.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-150 ease-out",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-action text-action-ink shadow-xs hover:bg-action-hover",
        secondary: "bg-surface text-ink shadow-xs ring-1 ring-line ring-inset hover:bg-surface-sunken",
        ghost: "text-ink-2 hover:bg-surface-sunken hover:text-ink",
        subtle: "bg-accent-soft text-accent hover:bg-accent-soft/70",
        danger: "bg-negative text-ink-inverse shadow-xs hover:bg-negative/90",
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-xs",
        md: "h-10 rounded-md px-4 text-sm",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "size-10 rounded-md",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
