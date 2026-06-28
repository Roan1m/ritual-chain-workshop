import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import abi from "@/abi/AIJudge";
import { CONTRACT, ritual } from "@/config";
import { useTx } from "@/useTx";
import { Card, CardHeader, CardBody, Field, Input, Textarea, Button, Badge } from "@/ui";

function dl(min: number): string {
  const d = new Date(Date.now() + min * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PRESETS = [
  { l: "Test · 10m / 1h", s: 10, r: 60 },
  { l: "1h / 6h", s: 60, r: 360 },
  { l: "1d / 3d", s: 1440, r: 4320 },
];

export function CreateBounty({ onCreated }: { onCreated: (id: bigint) => void }) {
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [rubric, setRubric] = useState("");
  const [sub, setSub] = useState(dl(10));
  const [rev, setRev] = useState(dl(60));
  const [reward, setReward] = useState("");
  const [created, setCreated] = useState<bigint | null>(null);

  const tx = useTx((r) => {
    try {
      const logs = parseEventLogs({ abi, eventName: "BountyCreated", logs: r.logs });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (logs[0] as any)?.args?.bountyId as bigint | undefined;
      if (id !== undefined) {
        setCreated(id);
        onCreated(id);
      }
    } catch {
      /* ignore */
    }
  });

  const subMs = new Date(sub).getTime();
  const revMs = new Date(rev).getTime();
  const valid =
    !!title.trim() && !!rubric.trim() && Number.isFinite(subMs) && Number.isFinite(revMs) && revMs > subMs;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    let value = 0n;
    try {
      value = reward.trim() ? parseEther(reward.trim()) : 0n;
    } catch {
      return;
    }
    try {
      await tx.run({
        address: CONTRACT,
        abi,
        functionName: "createBounty",
        args: [title.trim(), rubric.trim(), BigInt(subMs), BigInt(revMs)],
        value,
        chainId: ritual.id,
      });
    } catch {
      /* surfaced via tx.error */
    }
  }

  return (
    <Card>
      <CardHeader title="Create a bounty" subtitle="Fund a reward, set the commit + reveal windows." />
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Best gas-opt writeup" maxLength={200} />
          </Field>
          <Field label="Rubric" hint="What the AI judges against.">
            <Textarea rows={3} value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="Correctness 50%, clarity 30%, novelty 20%…" />
          </Field>
          <div className="rounded-lg border border-stone-800 bg-stone-950/40 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.l}
                  type="button"
                  onClick={() => {
                    setSub(dl(p.s));
                    setRev(dl(p.r));
                  }}
                  className="rounded-md border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-800"
                >
                  {p.l}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Submission deadline">
                <Input type="datetime-local" value={sub} onChange={(e) => setSub(e.target.value)} />
              </Field>
              <Field label="Reveal deadline">
                <Input type="datetime-local" value={rev} onChange={(e) => setRev(e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Reward (RITUAL)">
            <Input type="number" min="0" step="any" value={reward} onChange={(e) => setReward(e.target.value)} placeholder="0.01" />
          </Field>
          <Button type="submit" disabled={!isConnected || !valid || tx.isBusy} className="w-full">
            {tx.isBusy ? "Creating…" : "Create bounty"}
          </Button>
          {!isConnected && <p className="text-xs text-stone-500">Connect your wallet to create a bounty.</p>}
          {tx.error && <p className="text-xs text-red-300">{tx.error}</p>}
          {created !== null && <Badge tone="green">Created #{created.toString()} — loaded below.</Badge>}
        </form>
      </CardBody>
    </Card>
  );
}
