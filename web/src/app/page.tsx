"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { CreateBountyForm } from "@/components/CreateBountyForm";
import { LoadBountyPanel } from "@/components/LoadBountyPanel";
import { BountyView } from "@/components/BountyView";
import { Logo } from "@/components/Logo";
import { useRecentBounties } from "@/hooks/useRecentBounties";
import { isContractConfigured, contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { shortenAddress } from "@/lib/format";
import { Notice, Dot } from "@/components/ui";

const PHASES = [
  { n: "01", t: "Commit", d: "Post only a keccak256 hash — your answer is obscured." },
  { n: "02", t: "Reveal", d: "After the deadline, reveal answer + salt to prove it." },
  { n: "03", t: "Judge", d: "Ritual AI scores every revealed entry in one batch." },
  { n: "04", t: "Finalize", d: "The owner ratifies the ranking and pays the winner." },
];

const GUARANTEES = [
  { t: "Obscured submissions", d: "Only a hash is on-chain during the commit window — no one can read or copy an earlier answer." },
  { t: "One batch verdict", d: "judgeAll runs a single Ritual AI call over all revealed answers, never one per entry." },
  { t: "Human-in-the-loop", d: "The AI ranking is advisory; the bounty owner ratifies and releases the reward." },
];

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
        <span className="h-px w-6 bg-amber-400/70" />
        {eyebrow}
      </div>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-stone-100 sm:text-4xl">
        {title}
      </h2>
      {sub ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-400">{sub}</p> : null}
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-stone-800 bg-stone-900/50 ${className}`}>{children}</div>
  );
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const { ids, add } = useRecentBounties();

  useEffect(() => {
    if (selectedId !== null) add(selectedId);
  }, [selectedId, add]);

  const handleCreated = useCallback(
    (id: bigint) => {
      add(id);
      setSelectedId(id);
    },
    [add],
  );

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-800/80 bg-stone-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-md border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-300 sm:inline-flex">
              <Dot tone="amber" />
              {ritualChain.name}
            </span>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <section className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-60" />
          <div>
            <span className="inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
              <Dot tone="amber" />
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
                href="#how"
                className="inline-flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-stone-800"
              >
                How it works
              </a>
            </div>
          </div>

          {/* Redacted-dossier visual */}
          <div className="relative">
            <Panel className="p-5">
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
              <p className="mt-3 text-[11px] text-stone-500">
                Obscured on-chain until the reveal window opens.
              </p>
            </Panel>
            <div className="pointer-events-none absolute -right-3 -top-3 -z-10 h-full w-full rounded-xl border border-amber-500/20" />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-10">
          <SectionHeading
            eyebrow="Lifecycle"
            title="Four phases, zero leaks"
            sub="Answers are exposed only after the submission window has already closed."
          />
          <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-stone-800 bg-stone-800 sm:grid-cols-4">
            {PHASES.map((p) => (
              <div key={p.n} className="bg-stone-900/70 p-5">
                <div className="font-display text-2xl font-semibold text-amber-400">{p.n}</div>
                <div className="mt-1 text-sm font-semibold text-stone-100">{p.t}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{p.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {GUARANTEES.map((g) => (
              <Panel key={g.t} className="p-4">
                <div className="flex items-center gap-2">
                  <Dot tone="amber" />
                  <h3 className="text-sm font-semibold text-stone-100">{g.t}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{g.d}</p>
              </Panel>
            ))}
          </div>
        </section>

        {/* App */}
        <section id="app" className="py-10">
          <SectionHeading eyebrow="Get started" title="Open or create a bounty" />
          {!isContractConfigured && (
            <div className="mt-6">
              <Notice tone="amber">
                No contract address configured. Set{" "}
                <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in{" "}
                <code className="font-mono">.env.local</code> to interact on-chain.
              </Notice>
            </div>
          )}
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CreateBountyForm onCreated={handleCreated} />
            <LoadBountyPanel selectedId={selectedId} onSelect={setSelectedId} recentIds={ids} />
          </div>
          {selectedId !== null && (
            <div className="mt-6">
              <BountyView bountyId={selectedId} />
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="flex flex-col gap-3 border-t border-stone-800 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <Logo size={20} />
          <div className="font-mono">
            {contractAddress ? (
              <>
                {shortenAddress(contractAddress, 6)} · chain {ritualChain.id}
              </>
            ) : (
              <>Obscura · {ritualChain.name}</>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
