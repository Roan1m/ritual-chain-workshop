import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-stone-800 bg-stone-900/60 shadow-lg shadow-black/30",
        className,
      )}
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
          {subtitle ? <p className="mt-1 text-xs text-stone-400">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function Button({
  className,
  variant = "primary",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-amber-500 text-stone-950 ring-1 ring-inset ring-amber-300/40 hover:bg-amber-400"
      : "bg-stone-800 text-stone-100 ring-1 ring-inset ring-stone-700 hover:bg-stone-700";
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...rest}
    />
  );
}

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

const inputCls =
  "w-full rounded-lg border border-stone-700 bg-stone-950/60 px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "resize-y leading-relaxed", props.className)} />;
}

type Tone = "amber" | "green" | "red" | "stone" | "orange";

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    amber: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    green: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    red: "bg-red-500/15 text-red-300 ring-red-500/30",
    stone: "bg-stone-500/15 text-stone-300 ring-stone-500/30",
    orange: "bg-orange-500/15 text-orange-200 ring-orange-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
