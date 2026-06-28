import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { keccak256, encodePacked, bytesToHex, isHex, type Address, type Hex } from "viem";
import abi from "@/abi/AIJudge";
import { CONTRACT, EXECUTOR, ritual, EXPLORER } from "@/config";
import { useTx } from "@/useTx";
import { parseBounty, getBountyStatus, canCommit, canReveal, STATUS_META } from "@/lib/bounty";
import { shortenAddress, formatReward, formatRelative } from "@/lib/format";
import { buildJudgeAllLlmInput, type JudgeSubmission } from "@/lib/ritualLlm";
import { decodeAiReview } from "@/lib/aiReview";
import { Card, CardHeader, CardBody, Field, Input, Textarea, Button, Badge, Spinner } from "@/ui";

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}
const isBytes32 = (v: string): v is Hex => isHex(v) && v.length === 66;
const lsKey = (id: bigint, a: Address) => `obscura:${ritual.id}:${id}:${a.toLowerCase()}`;

type SubRow = readonly [Address, Hex, boolean, string];

export function BountyView({ bountyId }: { bountyId: bigint }) {
  const now = useNow();
  const { address } = useAccount();

  const { data, refetch } = useReadContract({
    address: CONTRACT,
    abi,
    functionName: "getBounty",
    args: [bountyId],
    chainId: ritual.id,
    query: { refetchInterval: 8000 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = data ? parseBounty(data as any) : undefined;
  const count = b ? Number(b.submissionCount) : 0;

  const subs = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT,
      abi,
      functionName: "getSubmission" as const,
      args: [bountyId, BigInt(i)] as const,
      chainId: ritual.id,
    })),
    query: { enabled: count > 0, refetchInterval: 8000 },
  });
  const rows: (SubRow | undefined)[] = (subs.data ?? []).map((r) => r.result as SubRow | undefined);

  if (!b) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-stone-400">Loading bounty #{bountyId.toString()}…</p>
        </CardBody>
      </Card>
    );
  }

  const status = getBountyStatus(b, now);
  const meta = STATUS_META[status];
  const isOwner = !!address && address.toLowerCase() === b.owner.toLowerCase();
  const decoded = decodeAiReview(b.aiReview);

  const mine = address ? rows.findIndex((r) => r && r[0].toLowerCase() === address.toLowerCase()) : -1;
  const hasCommitted = mine >= 0;
  const myRevealed = mine >= 0 ? !!rows[mine]?.[2] : false;

  const refetchAll = () => {
    refetch();
    subs.refetch();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardHeader
          title={
            <span className="font-display text-lg">
              #{bountyId.toString()} · {b.title}
            </span>
          }
          subtitle={b.rubric}
          action={
            <Badge tone={status === "commit" ? "green" : status === "finalized" ? "stone" : "amber"}>
              {meta.label}
            </Badge>
          }
        />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Reward" value={formatReward(b.reward)} />
          <Stat label="Submissions" value={`${count} · ${b.revealedCount.toString()} revealed`} />
          <Stat label="Submission deadline" value={formatRelative(b.submissionDeadline)} />
          <Stat label="Reveal deadline" value={formatRelative(b.revealDeadline)} />
        </CardBody>
      </Card>

      {/* Commit / Reveal */}
      {canCommit(b, now) && (
        <CommitCard bountyId={bountyId} address={address} hasCommitted={hasCommitted} onDone={refetchAll} />
      )}
      {canReveal(b, now) && (
        <RevealCard
          bountyId={bountyId}
          address={address}
          hasCommitted={hasCommitted}
          myRevealed={myRevealed}
          onDone={refetchAll}
        />
      )}

      {/* Submissions */}
      <Card>
        <CardHeader title="Submissions" subtitle="Hashes during commit; answers appear after each reveal." action={<Badge>{count}</Badge>} />
        <CardBody className="space-y-2">
          {count === 0 && <p className="text-sm text-stone-500">No submissions yet.</p>}
          {rows.map((r, i) =>
            r ? (
              <div key={i} className="rounded-lg border border-stone-800 bg-stone-950/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-stone-400">
                    #{i} · {shortenAddress(r[0])}
                  </span>
                  {r[2] ? <Badge tone="green">Revealed</Badge> : <Badge tone="amber">Sealed</Badge>}
                </div>
                {r[2] ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-200">{r[3]}</p>
                ) : (
                  <p className="mt-2 break-all font-mono text-xs text-stone-600">{r[1]}</p>
                )}
              </div>
            ) : null,
          )}
        </CardBody>
      </Card>

      {/* AI review */}
      {decoded && (
        <Card>
          <CardHeader title="AI review" subtitle="Generated by Ritual AI from the revealed answers." />
          <CardBody>
            {decoded.parsed ? (
              <div className="space-y-2 text-sm text-stone-200">
                <div>
                  Recommended winner: <span className="font-semibold text-amber-300">#{decoded.parsed.winnerIndex}</span>
                </div>
                {decoded.parsed.summary && <p className="text-stone-400">{decoded.parsed.summary}</p>}
              </div>
            ) : (
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-xs text-stone-300">
                {decoded.raw}
              </pre>
            )}
          </CardBody>
        </Card>
      )}

      {/* Owner actions */}
      {isOwner && (
        <OwnerActions bountyId={bountyId} b={b} now={now} rows={rows} decoded={decoded} onDone={refetchAll} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-stone-100">{value}</div>
    </div>
  );
}

function CommitCard({
  bountyId,
  address,
  hasCommitted,
  onDone,
}: {
  bountyId: bigint;
  address?: Address;
  hasCommitted: boolean;
  onDone: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [salt, setSalt] = useState<Hex>(randomSalt);
  const tx = useTx(() => {
    onDone();
  });

  const commitment =
    address && answer.trim() && isBytes32(salt)
      ? keccak256(encodePacked(["string", "bytes32", "address", "uint256"], [answer.trim(), salt, address, bountyId]))
      : null;

  async function commit(e: React.FormEvent) {
    e.preventDefault();
    if (!commitment || !address) return;
    try {
      localStorage.setItem(lsKey(bountyId, address), JSON.stringify({ answer: answer.trim(), salt }));
    } catch {
      /* ignore */
    }
    try {
      await tx.run({ address: CONTRACT, abi, functionName: "submitCommitment", args: [bountyId, commitment], chainId: ritual.id });
    } catch {
      /* surfaced */
    }
  }

  return (
    <Card>
      <CardHeader title="Commit an answer" subtitle="Only a hash goes on-chain now. Save your answer + salt to reveal later." />
      <CardBody>
        <form onSubmit={commit} className="space-y-3">
          <Field label="Your answer">
            <Textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your submission…" />
          </Field>
          <Field label="Salt" hint="Save this with your answer — both are needed to reveal.">
            <div className="flex gap-2">
              <Input value={salt} onChange={(e) => setSalt(e.target.value as Hex)} className="font-mono" />
              <Button type="button" variant="secondary" onClick={() => setSalt(randomSalt())}>
                New
              </Button>
            </div>
          </Field>
          {commitment && <p className="break-all rounded-md bg-black/30 p-2 font-mono text-[11px] text-stone-400">commitment: {commitment}</p>}
          <Button type="submit" disabled={!address || !answer.trim() || !isBytes32(salt) || tx.isBusy || hasCommitted} className="w-full">
            {hasCommitted ? "Already committed" : tx.isBusy ? "Committing…" : "Submit commitment"}
          </Button>
          {tx.error && <p className="text-xs text-red-300">{tx.error}</p>}
        </form>
      </CardBody>
    </Card>
  );
}

function RevealCard({
  bountyId,
  address,
  hasCommitted,
  myRevealed,
  onDone,
}: {
  bountyId: bigint;
  address?: Address;
  hasCommitted: boolean;
  myRevealed: boolean;
  onDone: () => void;
}) {
  const stored = (() => {
    try {
      return address ? JSON.parse(localStorage.getItem(lsKey(bountyId, address)) || "null") : null;
    } catch {
      return null;
    }
  })();
  const [answer, setAnswer] = useState<string>(stored?.answer ?? "");
  const [salt, setSalt] = useState<string>(stored?.salt ?? "");
  const tx = useTx(() => onDone());

  async function reveal(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !isBytes32(salt)) return;
    try {
      await tx.run({ address: CONTRACT, abi, functionName: "revealAnswer", args: [bountyId, answer.trim(), salt as Hex], chainId: ritual.id });
    } catch {
      /* surfaced */
    }
  }

  return (
    <Card>
      <CardHeader title="Reveal your answer" subtitle="The contract checks your answer + salt against your commitment." />
      <CardBody>
        <form onSubmit={reveal} className="space-y-3">
          {hasCommitted ? (
            <Badge tone={myRevealed ? "green" : "amber"}>{myRevealed ? "Already revealed ✓" : "Your commitment is on-chain"}</Badge>
          ) : (
            <Badge tone="amber">This wallet has no commitment here.</Badge>
          )}
          <Field label="Answer">
            <Textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Paste your committed answer…" />
          </Field>
          <Field label="Salt (0x… 32 bytes)">
            <Input value={salt} onChange={(e) => setSalt(e.target.value)} className="font-mono" placeholder="0x…" />
          </Field>
          <Button type="submit" disabled={!hasCommitted || myRevealed || !answer.trim() || !isBytes32(salt) || tx.isBusy} className="w-full">
            {myRevealed ? "Already revealed" : tx.isBusy ? "Revealing…" : "Reveal answer"}
          </Button>
          {tx.error && <p className="text-xs text-red-300">{tx.error}</p>}
        </form>
      </CardBody>
    </Card>
  );
}

function OwnerActions({
  bountyId,
  b,
  now,
  rows,
  decoded,
  onDone,
}: {
  bountyId: bigint;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b: any;
  now: number;
  rows: (SubRow | undefined)[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decoded: any;
  onDone: () => void;
}) {
  const judge = useTx(() => onDone());
  const fin = useTx(() => onDone());
  const [winner, setWinner] = useState<string>(decoded?.parsed ? String(decoded.parsed.winnerIndex) : "0");

  const revealPassed = now >= Number(b.revealDeadline);
  const canJudge = revealPassed && !b.judged && !b.finalized && Number(b.revealedCount) > 0;
  const canFinalize = b.judged && !b.finalized;

  async function runJudge() {
    const submissions: JudgeSubmission[] = rows
      .map((r, i) => (r && r[2] ? { index: i, submitter: r[0], answer: r[3] } : null))
      .filter(Boolean) as JudgeSubmission[];
    const llmInput = buildJudgeAllLlmInput({ executorAddress: EXECUTOR, title: b.title, rubric: b.rubric, submissions });
    try {
      await judge.run({ address: CONTRACT, abi, functionName: "judgeAll", args: [bountyId, llmInput], chainId: ritual.id });
    } catch {
      /* surfaced */
    }
  }
  async function runFinalize() {
    let idx = 0n;
    try {
      idx = BigInt(winner);
    } catch {
      return;
    }
    try {
      await fin.run({ address: CONTRACT, abi, functionName: "finalizeWinner", args: [bountyId, idx], chainId: ritual.id });
    } catch {
      /* surfaced */
    }
  }

  return (
    <Card>
      <CardHeader title="Owner controls" subtitle="Judge after the reveal deadline, then finalize one winner." />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={runJudge} disabled={!canJudge || judge.isBusy}>
            {judge.isBusy ? (
              <>
                <Spinner /> Judging…
              </>
            ) : (
              "Judge all (batch AI)"
            )}
          </Button>
          {!revealPassed && <span className="text-xs text-stone-500">Available after the reveal deadline.</span>}
        </div>
        {judge.error && <p className="text-xs text-red-300">{judge.error}</p>}

        <div className="flex flex-wrap items-end gap-2 border-t border-stone-800 pt-3">
          <div className="w-28">
            <Field label="Winner index">
              <Input value={winner} onChange={(e) => setWinner(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <Button variant="secondary" onClick={runFinalize} disabled={!canFinalize || fin.isBusy}>
            {fin.isBusy ? "Finalizing…" : "Finalize winner"}
          </Button>
        </div>
        {fin.error && <p className="text-xs text-red-300">{fin.error}</p>}
      </CardBody>
    </Card>
  );
}
