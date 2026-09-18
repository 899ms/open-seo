import type { FormEvent, ReactNode, RefObject } from "react";
import { TOOL_COUNTRIES } from "@/lib/free-tools/countries";

export type ToolStatus = "idle" | "loading" | "done" | "error";

export const FIELD_CLASS =
  "h-11 w-full min-w-0 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3.5 text-base text-neutral-900 placeholder:text-neutral-500 transition focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900";

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium text-[var(--color-brand-muted)]"
    >
      {children}
    </label>
  );
}

export function CountrySelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: number;
  onChange: (code: number) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      name="country"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className={FIELD_CLASS}
    >
      {TOOL_COUNTRIES.map((country) => (
        <option key={country.code} value={country.code}>
          {country.label}
        </option>
      ))}
    </select>
  );
}

export function SubmitButton({
  status,
  idleLabel,
  loadingLabel = "Checking…",
}: {
  status: ToolStatus;
  idleLabel: string;
  loadingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={status === "loading"}
      className="h-11 shrink-0 rounded-lg bg-neutral-950 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
    >
      {status === "loading" ? loadingLabel : idleLabel}
    </button>
  );
}

/**
 * The card every tool form lives in: fields, the invisible Turnstile mount,
 * the "Free · No signup" microcopy, and the error line.
 */
export function ToolForm({
  onSubmit,
  turnstileRef,
  status,
  errorMessage,
  cacheDuration = "24 hours",
  children,
}: {
  onSubmit: (event: FormEvent) => void;
  turnstileRef?: RefObject<HTMLDivElement | null>;
  status: ToolStatus;
  errorMessage: string;
  cacheDuration?: string;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 md:p-5"
    >
      {children}
      {turnstileRef ? (
        <div ref={turnstileRef} className="empty:hidden" />
      ) : null}
      <p className="mt-2.5 text-xs text-[var(--color-brand-muted)]">
        Free &middot; No signup
      </p>
      {status === "error" && errorMessage ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
      {status === "done" ? (
        <p
          role="status"
          className="mt-2 text-xs text-[var(--color-brand-muted)]"
        >
          Results may be cached for up to {cacheDuration}.
        </p>
      ) : null}
    </form>
  );
}
