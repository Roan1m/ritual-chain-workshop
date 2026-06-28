import { useState } from "react";
import { Connect } from "@/components/Connect";
import { CreateBounty } from "@/components/CreateBounty";
import { LoadBounty } from "@/components/LoadBounty";
import { BountyView } from "@/components/BountyView";
import { ritual, CONTRACT, EXPLORER } from "@/config";
import { shortenAddress } from "@/lib/format";

function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="13.5" stroke="#fbbf24" strokeWidth="2.3" />
      <rect x="8" y="17.4" width="24" height="5.2" rx="1.2" fill="#fbbf24" />
    </svg>
  );
}

const PHASES = [
  { n: "01", t: "Commit", d: "Post only a keccak256 hash — your answer is obscured." },
  { n: "02", t: "Reveal", d: "After the deadline, reveal answer + salt to prove it." },
  { n: "03", t: "Judge", d: "Ritual AI scores every revealed entry in one batch." },
  { n: "04", t: "Finalize", d: "The owner ratifies the ranking and pays the winner." },
];

export function App() {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-stone-800/80 bg-stone-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Mark />
            <div className="leading-none">
              <div className="font-display text-[16px] font-semibold tracking-tight text-stone-100">Obscura</div>
              <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.2em] text-stone-500">
                Blind Bounty Judge
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-md border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-300 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {ritual.name}
            </span>
            <Connect />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Hero */}
        <section className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-60" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Privacy-preserving · Commit-Reveal · Ritual
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Submissions stay <span className="text-amber-400">obscured</span> until the verdict.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-400">
              A blind bounty: entrants commit a hash, reveal after the deadline, and Ritual AI ranks
              every revealed answer in one batch. Nothing is readable — or copyable — before judging.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#app"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 ring-1 ring-inset ring-amber-300/40 transition hover:bg-amber-400"
              >
                Launch a bounty <span aria-hidden>→</span>
              </a>
              <a
                href={`${EXPLORER}/address/${CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-stone-800"
              >
                Contract ↗
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-5 shadow-lg shadow-black/30">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-stone-500">SUBMISSION #1</span>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  Sealed
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-5/6 rounded-sm bg-stone-800" />
                <div className="h-3 w-full rounded-sm bg-stone-800" />
                <div className="h-3 w-2/3 rounded-sm bg-stone-800" />
              </div>
              <div className="mt-4 border-t border-stone-800 pt-3">
                <div className="text-[11px] uppercase tracking-widest text-stone-500">commitment</div>
                <div className="mt-1 break-all font-mono text-xs text-amber-200/90">
                  0x7b1e…<span className="text-stone-600">a9f0</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Lifecycle */}
        <section id="how" className="py-8">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-stone-800 bg-stone-800 sm:grid-cols-4">
            {PHASES.map((p) => (
              <div key={p.n} className="bg-stone-900/70 p-5">
                <div className="font-display text-2xl font-semibold text-amber-400">{p.n}</div>
                <div className="mt-1 text-sm font-semibold text-stone-100">{p.t}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* App */}
        <section id="app" className="space-y-6 py-10">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CreateBounty onCreated={setSelectedId} />
            <LoadBounty selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          {selectedId !== null && <BountyView bountyId={selectedId} />}
        </section>

        <footer className="flex flex-col gap-3 border-t border-stone-800 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Mark size={18} />
            <span>Obscura · {ritual.name}</span>
          </div>
          <a
            href={`${EXPLORER}/address/${CONTRACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-stone-300"
          >
            {shortenAddress(CONTRACT, 6)}
          </a>
        </footer>
      </main>
    </div>
  );
}
