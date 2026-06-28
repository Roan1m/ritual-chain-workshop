import type { CSSProperties } from "react";

/**
 * Obscura brand mark: a circle (an entry) crossed by a redaction bar — the
 * answer is there, but obscured until reveal.
 */
export function Logo({
  className = "",
  showWordmark = true,
  size = 34,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  const box: CSSProperties = { height: size, width: size };
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid place-items-center" style={box}>
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="13.5" stroke="#fbbf24" strokeWidth="2.3" />
          <rect x="8" y="17.4" width="24" height="5.2" rx="1.2" fill="#fbbf24" />
        </svg>
      </span>
      {showWordmark ? (
        <div className="leading-none">
          <div className="font-display text-[16px] font-semibold tracking-tight text-stone-100">
            Obscura
          </div>
          <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.2em] text-stone-500">
            Blind Bounty Judge
          </div>
        </div>
      ) : null}
    </div>
  );
}
