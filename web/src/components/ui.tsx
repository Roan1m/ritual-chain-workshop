"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import type { TxState } from "@/hooks/useWriteTx";

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-stone-800 bg-stone-900/60 shadow-lg shadow-black/30 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-800 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 h-4 w-0.5 shrink-0 bg-amber-400" />
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-stone-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-relaxed text-stone-400">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/* ----------------------------------------------------------------- Badge */

type Tone = "green" | "amber" | "indigo" | "violet" | "cyan" | "zinc" | "red";

const TONES: Record<Tone, string> = {
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  // legacy keys remapped to the Obscura palette
  indigo: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  violet: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  cyan: "bg-orange-500/15 text-orange-200 ring-orange-500/30",
  zinc: "bg-stone-500/15 text-stone-300 ring-stone-500/30",
  red: "bg-red-500/15 text-red-300 ring-red-500/30",
};

export function Badge({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- Dot */

export function Dot({ tone = "amber" }: { tone?: Tone }) {
  const color: Record<Tone, string> = {
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    indigo: "bg-amber-400",
    violet: "bg-amber-400",
    cyan: "bg-orange-400",
    zinc: "bg-stone-400",
    red: "bg-red-400",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${color[tone]}`} />;
}

/* ---------------------------------------------------------------- Button */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 disabled:cursor-not-allowed disabled:opacity-50";
  const styles: Record<string, string> = {
    primary:
      "bg-amber-500 text-stone-950 hover:bg-amber-400 ring-1 ring-inset ring-amber-300/40 active:translate-y-px",
    secondary:
      "bg-stone-800 text-stone-100 ring-1 ring-inset ring-stone-700 hover:bg-stone-700 active:translate-y-px",
    ghost: "text-stone-300 hover:bg-stone-800/60 hover:text-stone-100",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ----------------------------------------------------------- Form fields */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-stone-700 bg-stone-950/60 px-3.5 py-2.5 text-sm text-stone-100 transition placeholder:text-stone-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`${inputBase} resize-y leading-relaxed ${props.className ?? ""}`} />
  );
}

/* ---------------------------------------------------------- Tx status UI */

const TX_LABEL: Record<TxState, string> = {
  idle: "",
  wallet: "Waiting for wallet…",
  pending: "Confirming on-chain…",
  confirmed: "Confirmed",
  failed: "Failed",
};

const TX_TONE: Record<TxState, Tone> = {
  idle: "zinc",
  wallet: "amber",
  pending: "amber",
  confirmed: "green",
  failed: "red",
};

export function TxStatus({
  state,
  error,
  hash,
  explorerBase,
}: {
  state: TxState;
  error?: string | null;
  hash?: `0x${string}`;
  explorerBase?: string;
}) {
  if (state === "idle" && !error) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <Badge tone={TX_TONE[state]}>
        {(state === "wallet" || state === "pending") && <Spinner />}
        {state === "failed" && error ? error : TX_LABEL[state]}
      </Badge>
      {hash && explorerBase ? (
        <a
          href={`${explorerBase}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
        >
          View tx
        </a>
      ) : null}
    </div>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function Notice({
  tone = "zinc",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-800 bg-stone-950/50 px-3.5 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-stone-100">{value}</div>
    </div>
  );
}
