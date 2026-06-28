import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ritual } from "@/config";
import { shortenAddress } from "@/lib/format";
import { Button, Spinner } from "@/ui";

function avatar(addr: string): string {
  const a = parseInt(addr.slice(2, 6) || "0", 16) % 360;
  const b = parseInt(addr.slice(6, 10) || "0", 16) % 360;
  return `linear-gradient(135deg, hsl(${a} 85% 62%), hsl(${b} 85% 52%))`;
}

export function Connect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);

  const wrong = isConnected && chainId !== undefined && chainId !== ritual.id;
  const auto = useRef(false);
  useEffect(() => {
    if (wrong) {
      if (!auto.current) {
        auto.current = true;
        switchChain({ chainId: ritual.id });
      }
    } else {
      auto.current = false;
    }
  }, [wrong, switchChain]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrong && (
          <Button variant="secondary" disabled={switching} onClick={() => switchChain({ chainId: ritual.id })}>
            {switching ? (
              <>
                <Spinner /> Switching…
              </>
            ) : (
              <>Switch to Ritual</>
            )}
          </Button>
        )}
        <button
          onClick={() => disconnect()}
          title="Disconnect"
          className="group inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900 py-1 pl-1 pr-3 text-sm text-stone-100 transition hover:border-red-400/40"
        >
          <span className="h-6 w-6 rounded-full ring-1 ring-white/15" style={{ background: avatar(address) }} />
          <span className="font-mono text-xs">{shortenAddress(address)}</span>
          <span className="text-[11px] leading-none text-stone-500 transition group-hover:text-red-300">✕</span>
        </button>
      </div>
    );
  }

  const seen = new Set<string>();
  const list = connectors.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} disabled={isPending}>
        {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-stone-700 bg-stone-900 p-1 shadow-xl">
          {list.length === 0 && <div className="px-3 py-2 text-xs text-stone-500">No wallet found.</div>}
          {list.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                connect({ connector: c });
                setOpen(false);
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-stone-200 hover:bg-stone-800"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
