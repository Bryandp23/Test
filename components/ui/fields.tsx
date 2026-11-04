"use client";

import { useId } from "react";

const inputCls =
  "mt-1.5 block w-full min-h-12 rounded-xl border-2 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-[#7a8584] transition focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger";

interface Base {
  label: string;
  hint?: string;
  error?: string;
  warning?: string;
  optional?: boolean;
  className?: string;
}

function Messages({ id, hint, error, warning }: { id: string; hint?: string; error?: string; warning?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 flex gap-1.5 text-sm font-medium text-danger">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
      {!error && warning && (
        <p id={`${id}-warn`} className="mt-1.5 text-sm text-warn">
          {warning}
        </p>
      )}
    </>
  );
}

function described(id: string, p: Base) {
  return [p.hint && `${id}-hint`, p.error && `${id}-err`, !p.error && p.warning && `${id}-warn`].filter(Boolean).join(" ") || undefined;
}

function Label({ id, label, optional }: { id: string; label: string; optional?: boolean }) {
  return (
    <label htmlFor={id} className="block font-semibold text-ink">
      {label} {optional && <span className="font-normal text-muted">(facultatif)</span>}
    </label>
  );
}

export function TextField(
  p: Base & { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; name?: string; autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; required?: boolean; onBlur?: () => void }
) {
  const id = useId();
  return (
    <div className={p.className}>
      <Label id={id} label={p.label} optional={p.optional} />
      <input
        id={id}
        name={p.name}
        type={p.type ?? "text"}
        value={p.value}
        placeholder={p.placeholder}
        autoComplete={p.autoComplete ?? "off"}
        inputMode={p.inputMode}
        required={p.required}
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
        aria-invalid={!!p.error}
        aria-describedby={described(id, p)}
        className={`${inputCls} ${p.error ? "border-danger" : "border-line"}`}
      />
      <Messages id={id} hint={p.hint} error={p.error} warning={p.warning} />
    </div>
  );
}

export function TextArea(p: Base & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <div className={p.className}>
      <Label id={id} label={p.label} optional={p.optional} />
      <textarea
        id={id}
        value={p.value}
        rows={p.rows ?? 4}
        placeholder={p.placeholder}
        maxLength={p.maxLength}
        onChange={(e) => p.onChange(e.target.value)}
        aria-invalid={!!p.error}
        aria-describedby={described(id, p)}
        className={`${inputCls} ${p.error ? "border-danger" : "border-line"} resize-y`}
      />
      {p.maxLength && (
        <p className="mt-1 text-right text-xs text-muted" aria-hidden="true">
          {p.value.length} / {p.maxLength}
        </p>
      )}
      <Messages id={id} hint={p.hint} error={p.error} warning={p.warning} />
    </div>
  );
}

export function Select<T extends string>(p: Base & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = useId();
  return (
    <div className={p.className}>
      <Label id={id} label={p.label} optional={p.optional} />
      <select
        id={id}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value as T)}
        aria-invalid={!!p.error}
        aria-describedby={described(id, p)}
        className={`${inputCls} ${p.error ? "border-danger" : "border-line"} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234a5655%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
      >
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Messages id={id} hint={p.hint} error={p.error} warning={p.warning} />
    </div>
  );
}

export function RadioCards<T extends string>({
  legend,
  value,
  onChange,
  options,
  name,
  hint,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string; icon?: React.ReactNode }[];
  name: string;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="font-semibold text-ink">{legend}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={`mt-2 grid gap-2 ${options.length === 2 ? "sm:grid-cols-2" : options.length >= 3 ? "sm:grid-cols-3" : ""}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition ${
              value === o.value ? "border-brand-700 bg-brand-50" : "border-line bg-white hover:border-brand"
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 size-5 shrink-0 accent-[#1d7a75]" />
            <span>
              <span className="flex items-center gap-2 font-semibold">
                {o.icon}
                {o.label}
              </span>
              {o.description && <span className="block text-sm text-muted">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v = {
    primary: "shape bg-brand-700 text-white hover:bg-brand-800 shadow-sm",
    secondary: "rounded-xl border-2 border-brand-700 text-brand-800 bg-white hover:bg-brand-50",
    ghost: "rounded-xl text-brand-800 hover:bg-brand-50",
    danger: "rounded-xl border-2 border-danger text-danger bg-white hover:bg-danger-50",
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-12 items-center justify-center gap-2 px-5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${v} ${className}`}
    />
  );
}
