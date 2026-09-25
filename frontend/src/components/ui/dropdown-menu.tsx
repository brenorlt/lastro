"use client";

import { DropdownMenu as Menu } from "radix-ui";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Menu.Content>>(
  ({ className, sideOffset = 6, align = "end", ...props }, ref) => (
    <Menu.Portal>
      <Menu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-52 rounded-lg bg-surface-raised p-1 shadow-lg ring-1 ring-line animate-fade-in",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  ),
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <Menu.Item
    ref={ref}
    className={cn(
      "flex h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-sm outline-none",
      "data-[highlighted]:bg-surface-sunken data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:text-ink-3",
      destructive ? "text-negative [&_svg]:text-negative" : "text-ink",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-2.5 pb-1 pt-2 text-2xs font-medium text-ink-3", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}

export function DropdownMenuShortcut({ children }: { children: string }) {
  return <span className="ml-auto text-2xs tracking-wider text-ink-3">{children}</span>;
}
