"use client";
// Composants de base, construits sur Radix (accessibilité clavier, focus, lecteurs d'écran).
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Dialog as RDialog, DropdownMenu as RMenu, Tooltip as RTooltip, Popover as RPopover } from "radix-ui";
import { Check, ChevronRight, X } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// --- Boutons --------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong font-medium",
  secondary: "bg-raised text-fg hover:bg-hover border border-line",
  ghost: "text-muted hover:text-fg hover:bg-raised",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }>(
  function Button({ variant = "secondary", size = "md", className, ...p }, ref) {
    return (
      <button
        ref={ref}
        {...p}
        className={cx(
          "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
          size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]",
          VARIANTS[variant],
          className,
        )}
      />
    );
  },
);

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }>(
  function IconButton({ label, size = "md", className, children, ...p }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        {...p}
        className={cx(
          "inline-flex shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-raised hover:text-fg disabled:opacity-40",
          size === "sm" ? "size-6" : "size-8",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);

// --- Champs ---------------------------------------------------------------------

const field = "w-full rounded-md border border-line bg-bg/60 px-2.5 text-[13px] text-fg placeholder:text-faint outline-none transition-colors focus:border-accent";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(field, "h-8", className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} {...p} className={cx(field, "py-2 leading-relaxed", className)} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} {...p} className={cx(field, "h-8 cursor-pointer appearance-none bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a5a9b4' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
});

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-2xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-faint">{hint}</span>}
    </label>
  );
}

// --- Dialogue -------------------------------------------------------------------

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/55 animate-fade-in" />
        <RDialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border border-line bg-surface shadow-2xl shadow-black/40 outline-none animate-slide-in sm:inset-auto sm:top-[10vh] sm:left-1/2 sm:max-h-[80vh] sm:w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:rounded-xl"
          style={{ maxWidth: width }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 pt-4 pb-3">
            <div>
              <RDialog.Title className="text-[15px] font-semibold tracking-tight">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-[12px] text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <IconButton label="Fermer" size="sm" className="-mr-1">
                <X className="size-4" />
              </IconButton>
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

// --- Menus ----------------------------------------------------------------------

export const Menu = RMenu.Root;
export const MenuTrigger = RMenu.Trigger;

export function MenuContent({ children, align = "end", className }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <RMenu.Portal>
      <RMenu.Content
        align={align}
        sideOffset={4}
        collisionPadding={8}
        className={cx("z-50 min-w-[200px] rounded-lg border border-line bg-raised p-1 shadow-xl shadow-black/30 animate-fade-in", className)}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </RMenu.Content>
    </RMenu.Portal>
  );
}

export function MenuItem({ icon, children, onSelect, danger, shortcut, disabled }: { icon?: ReactNode; children: ReactNode; onSelect?: () => void; danger?: boolean; shortcut?: string; disabled?: boolean }) {
  return (
    <RMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cx(
        "flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover",
        danger ? "text-danger" : "text-fg",
      )}
    >
      <span className="flex size-4 items-center justify-center text-muted [&>svg]:size-4">{icon}</span>
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-2xs text-faint">{shortcut}</span>}
    </RMenu.Item>
  );
}

export function MenuCheckbox({ checked, onCheckedChange, children, swatch }: { checked: boolean; onCheckedChange: (v: boolean) => void; children: ReactNode; swatch?: ReactNode }) {
  return (
    <RMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none data-[highlighted]:bg-hover"
    >
      <span className="flex size-4 items-center justify-center rounded border border-line data-[state=checked]:border-accent">
        <RMenu.ItemIndicator>
          <Check className="size-3 text-accent" />
        </RMenu.ItemIndicator>
      </span>
      {swatch}
      <span className="flex-1 truncate">{children}</span>
    </RMenu.CheckboxItem>
  );
}

export function MenuSub({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <RMenu.Sub>
      <RMenu.SubTrigger className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none data-[highlighted]:bg-hover data-[state=open]:bg-hover">
        <span className="flex size-4 items-center justify-center text-muted [&>svg]:size-4">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="size-3.5 text-faint" />
      </RMenu.SubTrigger>
      <RMenu.Portal>
        <RMenu.SubContent sideOffset={4} collisionPadding={8} className="z-50 max-h-[60vh] min-w-[220px] overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-xl shadow-black/30 animate-fade-in">
          {children}
        </RMenu.SubContent>
      </RMenu.Portal>
    </RMenu.Sub>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <RMenu.Label className="px-2 pt-2 pb-1 text-2xs font-medium tracking-wide text-faint uppercase">{children}</RMenu.Label>;
}
export function MenuSeparator() {
  return <RMenu.Separator className="my-1 h-px bg-line-soft" />;
}

// --- Popover / Tooltip ------------------------------------------------------------

export const Popover = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;
export function PopoverContent({ children, className, align = "start" }: { children: ReactNode; className?: string; align?: "start" | "end" | "center" }) {
  return (
    <RPopover.Portal>
      <RPopover.Content align={align} sideOffset={6} collisionPadding={8} className={cx("z-50 rounded-lg border border-line bg-raised p-3 shadow-xl shadow-black/30 animate-fade-in outline-none", className)}>
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  );
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RTooltip.Root delayDuration={350}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content sideOffset={6} className="z-[60] rounded-md border border-line bg-raised px-2 py-1 text-[12px] text-fg shadow-lg animate-fade-in">
          {label}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
export const TipProvider = RTooltip.Provider;

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-bg px-1 font-mono text-[10px] text-faint">{children}</kbd>;
}
