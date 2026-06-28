"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import { Dot, Spinner } from "@/components/ui";

/** Small wallet glyph. */
function WalletGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M16 6V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
      <circle cx="16.5" cy="12.5" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Deterministic two-tone "blockie" gradient derived from the address. */
function avatarGradient(addr: string): string {
  const a = parseInt(addr.slice(2, 6) || "0", 16) % 360;
  const b = parseInt(addr.slice(6, 10) || "0", 16) % 360;
  return `linear-gradient(135deg, hsl(${a} 85% 62%), hsl(${b} 85% 52%))`;
}

export function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const wrongChain = isConnected && chainId !== undefined && chainId !== ritualChain.id;

  // Auto add/switch to Ritual on the wrong chain (one-shot per wrong-chain state).
  const autoSwitched = useRef(false);
  useEffect(() => {
    if (wrongChain) {
      if (!autoSwitched.current) {
        autoSwitched.current = true;
        switchChain({ chainId: ritualChain.id });
      }
    } else {
      autoSwitched.current = false;
    }
  }, [wrongChain, switchChain]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrongChain && (
          <button
            onClick={() => switchChain({ chainId: ritualChain.id })}
            disabled={isSwitching}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
          >
            {isSwitching ? (
              <>
                <Spinner /> Switching…
              </>
            ) : (
              <>Switch to {ritualChain.name}</>
            )}
          </button>
        )}
        <button
          onClick={() => disconnect()}
          title="Disconnect"
          className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] py-1 pl-1 pr-3 text-sm font-medium text-stone-100 transition hover:border-red-400/40 hover:bg-white/[0.08]"
        >
          <span
            className="h-6 w-6 rounded-full ring-1 ring-white/20"
            style={{ background: avatarGradient(address) }}
          />
          <span className="font-mono text-xs">{shortenAddress(address)}</span>
          <span className="text-[11px] leading-none text-stone-500 transition group-hover:text-red-300">
            ✕
          </span>
        </button>
      </div>
    );
  }

  // Dedupe connectors by name (injected + metaMask can overlap).
  const seen = new Set<string>();
  const list = connectors.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="group inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 shadow-[0_0_18px_-6px_rgba(245,158,11,0.6)] transition hover:border-amber-300/70 hover:bg-amber-500/20 disabled:opacity-60"
      >
        <WalletGlyph className="h-4 w-4 text-amber-300 transition group-hover:text-amber-200" />
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-stone-900/95 p-1 shadow-xl backdrop-blur">
          {list.length === 0 && (
            <div className="px-3 py-2 text-xs text-stone-500">No wallet connectors found.</div>
          )}
          {list.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-stone-200 transition hover:bg-white/10"
            >
              <WalletGlyph className="h-3.5 w-3.5 text-stone-400" />
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
