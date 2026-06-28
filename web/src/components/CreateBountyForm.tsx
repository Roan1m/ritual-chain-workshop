"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import { contractAddress, isContractConfigured } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import aiJudgeAbi from "@/abi/AIJudge";
import { useWriteTx } from "@/hooks/useWriteTx";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Textarea,
  Button,
  TxStatus,
  Notice,
} from "@/components/ui";

const explorerBase = ritualChain.blockExplorers?.default.url;

/** datetime-local value = now + N minutes, in the input's expected format. */
function defaultDeadline(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CreateBountyForm({ onCreated }: { onCreated?: (bountyId: bigint) => void }) {
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [rubric, setRubric] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState(defaultDeadline(10));
  const [revealDeadline, setRevealDeadline] = useState(defaultDeadline(60));
  const [reward, setReward] = useState("");
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const tx = useWriteTx((receipt) => {
    try {
      const logs = parseEventLogs({
        abi: aiJudgeAbi,
        eventName: "BountyCreated",
        logs: receipt.logs,
      });
      const id = logs[0]?.args?.bountyId;
      if (id !== undefined) {
        setCreatedId(id);
        onCreated?.(id);
      }
    } catch {
      /* couldn't decode — not fatal */
    }
  });

  const validation = useMemo(() => {
    if (!title.trim()) return "Title is required.";
    if (!rubric.trim()) return "Rubric is required.";
    if (!submissionDeadline) return "Pick a submission deadline.";
    if (!revealDeadline) return "Pick a reveal deadline.";
    const sub = new Date(submissionDeadline).getTime();
    const rev = new Date(revealDeadline).getTime();
    if (!Number.isFinite(sub) || !Number.isFinite(rev)) return "Invalid deadline.";
    if (rev <= sub) return "Reveal deadline must be after the submission deadline.";
    if (reward !== "") {
      try {
        parseEther(reward);
      } catch {
        return "Reward must be a valid number.";
      }
    }
    return null;
  }, [title, rubric, submissionDeadline, revealDeadline, reward]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validation || !contractAddress) return;

    const subMs = new Date(submissionDeadline).getTime();
    const revMs = new Date(revealDeadline).getTime();
    if (subMs <= Date.now()) {
      window.alert("Submission deadline must be in the future.");
      return;
    }

    // Ritual block timestamps are in milliseconds.
    const subTs = BigInt(subMs);
    const revTs = BigInt(revMs);
    const value = reward.trim() === "" ? 0n : parseEther(reward.trim());
    setCreatedId(null);

    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "createBounty",
        args: [title.trim(), rubric.trim(), subTs, revTs],
        value,
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Create a bounty"
        subtitle="Fund a reward, set the commit and reveal windows, and define how submissions are judged."
      />
      <CardBody>
        {!isContractConfigured && (
          <Notice tone="amber">
            Set <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your{" "}
            <code className="font-mono">.env.local</code> to enable transactions.
          </Notice>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best gas-optimization writeup"
              maxLength={200}
            />
          </Field>

          <Field label="Rubric" hint="How submissions are scored. The AI judges only against this.">
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={4}
              placeholder="Correctness 50%, clarity 30%, novelty 20%…"
            />
          </Field>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Commit
              <span className="text-stone-600">→</span>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Reveal
              <span className="text-stone-600">→</span>
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Judge
            </div>
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Quick set
              </span>
              {[
                { label: "Test · 10m / 1h", s: 10, r: 60 },
                { label: "1h / 6h", s: 60, r: 360 },
                { label: "1d / 3d", s: 1440, r: 4320 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setSubmissionDeadline(defaultDeadline(p.s));
                    setRevealDeadline(defaultDeadline(p.r));
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-stone-300 transition hover:bg-white/[0.08]"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Submission deadline" hint="Commit phase ends here.">
                <Input
                  type="datetime-local"
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                />
              </Field>
              <Field label="Reveal deadline" hint="Reveal phase ends here; judging follows.">
                <Input
                  type="datetime-local"
                  value={revealDeadline}
                  onChange={(e) => setRevealDeadline(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <Field label="Reward (RITUAL)" hint="Locked in the contract on create.">
            <Input
              type="number"
              min="0"
              step="any"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="1.0"
            />
          </Field>

          {validation && (title || rubric || reward) ? (
            <p className="text-xs text-amber-300">{validation}</p>
          ) : null}

          <Button
            type="submit"
            disabled={!isConnected || !isContractConfigured || !!validation || tx.isBusy}
            className="w-full"
          >
            {tx.isBusy ? "Creating…" : "Create bounty"}
          </Button>

          {!isConnected && (
            <p className="text-xs text-stone-500">Connect your wallet to create a bounty.</p>
          )}

          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />

          {createdId !== null && (
            <Notice tone="green">
              Bounty created with id{" "}
              <span className="font-mono font-semibold">#{createdId.toString()}</span>. Loaded
              below.
            </Notice>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
