"use client";

import { X } from "lucide-react";
import { AlertDialog as Alert, Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay = "fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] animate-fade-in";

interface DialogContentProps {
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Modal centralizado para uma tarefa curta e focada. */
export function DialogContent({ title, description, children, footer, className }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,760px)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-xl bg-surface-raised shadow-lg ring-1 ring-line animate-rise focus:outline-none",
          className,
        )}
        {...(!description && { "aria-describedby": undefined })}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-ink-2">{description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton label="Fechar" size="icon-sm" className="-mr-2 -mt-1">
              <X />
            </IconButton>
          </DialogPrimitive.Close>
        </header>
        {children && <div className="overflow-y-auto px-6 py-4">{children}</div>}
        {footer && <footer className="flex flex-col-reverse gap-2 px-6 pb-6 pt-2 sm:flex-row sm:justify-end">{footer}</footer>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

interface DrawerContentProps extends DialogContentProps {
  /** Lateral no desktop; no mobile vira sheet inferior. */
  side?: "right" | "bottom";
}

/** Distância de arrasto (px) a partir da qual soltar o grabber fecha a sheet. */
const DISMISS_THRESHOLD = 120;

/** Painel para formulários longos e detalhes. No mobile, desliza de baixo. */
export function DrawerContent({ title, description, children, footer, className, side = "right" }: DrawerContentProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  function onGrabberPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onGrabberPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartY.current));
  }
  function onGrabberPointerUp() {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragY > DISMISS_THRESHOLD) closeRef.current?.click();
    setDragY(0);
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        className={cn(
          "fixed z-50 flex flex-col bg-surface-raised shadow-lg ring-1 ring-line focus:outline-none",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl animate-rise pb-[env(safe-area-inset-bottom)]",
          side === "right" && "sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:w-[440px] sm:rounded-xl",
          className,
        )}
        {...(!description && { "aria-describedby": undefined })}
      >
        {/* Grabber: arraste para baixo para fechar (área de toque maior que a barra visível). */}
        <div
          className="flex touch-none justify-center py-2.5 sm:hidden"
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={onGrabberPointerUp}
          onPointerCancel={onGrabberPointerUp}
        >
          <div aria-hidden className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-ink-2">{description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton ref={closeRef} label="Fechar" size="icon-sm" className="-mr-2">
              <X />
            </IconButton>
          </DialogPrimitive.Close>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex gap-2 border-t border-line px-6 py-4 sm:justify-end">{footer}</footer>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Verbo da ação, ex.: "Excluir conta". Nunca "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  destructive?: boolean;
}

/** Confirmação para ações irreversíveis. O foco inicial fica em Cancelar. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Alert.Root open={open} onOpenChange={onOpenChange}>
      <Alert.Portal>
        <Alert.Overlay className={overlay} />
        <Alert.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface-raised p-6 shadow-lg ring-1 ring-line animate-rise">
          <Alert.Title className="text-lg font-semibold text-ink">{title}</Alert.Title>
          <Alert.Description className="mt-2 text-sm text-ink-2">{description}</Alert.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Alert.Cancel asChild>
              <Button variant="secondary">Cancelar</Button>
            </Alert.Cancel>
            <Button variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Alert.Content>
      </Alert.Portal>
    </Alert.Root>
  );
}
