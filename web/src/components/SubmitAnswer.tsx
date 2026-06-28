"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import {
  keccak256,
  encodePacked,
  bytesToHex,
  isHex,
  type Address,
  type Hex,
} from "viem";
import { useNow } from "@/hooks/useNow";
import aiJudgeAbi from "@/abi/AIJudge";
import { contractAddress } from "@/config/contract";
import { ritualChain } from "@/config/wagmi";
import { canCommit, canReveal, type Bounty } from "@/lib/bounty";
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

function randomSalt(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}
function isBytes32(v: string): v is Hex {
  return isHex(v) && v.length === 66;
}

type Stored = { answer: string; salt: Hex };
function storageKey(bountyId: bigint, addr: Address) {
  return `aijudge-commit:${ritualChain.id}:${bountyId}:${addr.toLowerCase()}`;
}
function loadStored(bountyId: bigint, addr: Address): Stored | null {
  try {
    const raw = localStorage.getItem(storageKey(bountyId, addr));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function SubmitAnswer({
  bountyId,
  bounty,
  onSubmitted,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onSubmitted: () => void;
}) {
  const { address, isConnected } = useAccount();
  const now = useNow();

  const commitOpen = canCommit(bounty, now);
  const revealOpen = canReveal(bounty, now);

  const [answer, setAnswer] = useState("");
  const [salt, setSalt] = useState<Hex>(randomSalt);

  const stored = address ? loadStored(bountyId, address) : null;
  const [revealAnswer, setRevealAnswer] = useState(stored?.answer ?? "");
  const [revealSalt, setRevealSalt] = useState<string>(stored?.salt ?? "");

  // On-chain commitment detection: scan this bounty's submissions for one made
  // by the connected wallet. Works against the deployed contract (no special
  // getSubmissionIndex view needed) and is independent of localStorage.
  const count = Number(bounty.submissionCount);
  const scanContracts = Array.from({ length: count }, (_, i) => ({
    address: contractAddress as Address,
    abi: aiJudgeAbi,
    functionName: "getSubmission" as const,
    args: [bountyId, BigInt(i)] as const,
    chainId: ritualChain.id,
  }));
  const scan = useReadContracts({
    contracts: scanContracts,
    query: { enabled: !!address && !!contractAddress && count > 0 },
  });

  let hasCommitted = false;
  let myIndex: number | undefined;
  let myRevealed = false;
  if (address && scan.data) {
    scan.data.forEach((r, i) => {
      const sub = r.result as
        | readonly [Address, `0x${string}`, boolean, string]
        | undefined;
      if (sub && sub[0] && sub[0].toLowerCase() === address.toLowerCase()) {
        hasCommitted = true;
        myIndex = i;
        myRevealed = sub[2];
      }
    });
  }

  const commitTx = useWriteTx(() => {
    setAnswer("");
    scan.refetch();
    onSubmitted();
  });
  const revealTx = useWriteTx(() => {
    if (address) {
      try {
        localStorage.removeItem(storageKey(bountyId, address));
      } catch {
        /* ignore */
      }
    }
    scan.refetch();
    onSubmitted();
  });

  if (!commitOpen && !revealOpen) return null;

  const commitment =
    address && answer.trim() && isBytes32(salt)
      ? keccak256(
          encodePacked(
            ["string", "bytes32", "address", "uint256"],
            [answer.trim(), salt, address, bountyId],
          ),
        )
      : null;

  async function handleCommit(e: React.FormEvent) {
    e.preventDefault();
    if (!commitment || !contractAddress || !address) return;
    try {
      localStorage.setItem(
        storageKey(bountyId, address),
        JSON.stringify({ answer: answer.trim(), salt } satisfies Stored),
      );
    } catch {
      /* ignore */
    }
    try {
      await commitTx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "submitCommitment",
        args: [bountyId, commitment],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via commitTx.state */
    }
  }

  async function handleReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!revealAnswer.trim() || !isBytes32(revealSalt) || !contractAddress) return;
    try {
      await revealTx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "revealAnswer",
        args: [bountyId, revealAnswer.trim(), revealSalt],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via revealTx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title={commitOpen ? "Commit an answer" : "Reveal your answer"}
        subtitle={
          commitOpen
            ? "Only the hash goes on-chain now. Save your answer + salt — you need both to reveal."
            : "Reveal the exact answer + salt you committed with."
        }
      />
      <CardBody>
        {commitOpen && (
          <form onSubmit={handleCommit} className="space-y-3">
            <Field label="Your answer">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="Write your submission…"
              />
            </Field>
            <Field label="Salt" hint="Save this together with your answer — you'll paste both to reveal.">
              <div className="flex gap-2">
                <Input
                  value={salt}
                  onChange={(e) => setSalt(e.target.value as Hex)}
                  className="font-mono"
                />
                <Button type="button" variant="secondary" onClick={() => setSalt(randomSalt())}>
                  New
                </Button>
              </div>
            </Field>
            {commitment && (
              <p className="break-all rounded-lg bg-black/30 p-2 font-mono text-[11px] text-stone-400">
                commitment: {commitment}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                !isConnected ||
                !answer.trim() ||
                !isBytes32(salt) ||
                commitTx.isBusy ||
                hasCommitted
              }
              className="w-full"
            >
              {hasCommitted
                ? "Already committed"
                : commitTx.isBusy
                  ? "Committing…"
                  : "Submit commitment"}
            </Button>
            {!isConnected && (
              <p className="text-xs text-stone-500">Connect your wallet to commit.</p>
            )}
            <TxStatus
              state={commitTx.state}
              error={commitTx.error}
              hash={commitTx.hash}
              explorerBase={explorerBase}
            />
          </form>
        )}

        {revealOpen && (
          <form onSubmit={handleReveal} className="space-y-3">
            {hasCommitted ? (
              <Notice tone="violet">
                Revealing your commitment
                {myIndex !== undefined ? (
                  <>
                    {" "}
                    (index <span className="font-mono">#{myIndex}</span>)
                  </>
                ) : null}
                {myRevealed ? " — already revealed ✓" : "."}
              </Notice>
            ) : (
              <Notice tone="amber">
                This wallet has no commitment for this bounty — nothing to reveal. (Reveal must come
                from the same account that committed.)
              </Notice>
            )}
            <Field label="Original answer">
              <Textarea
                value={revealAnswer}
                onChange={(e) => setRevealAnswer(e.target.value)}
                rows={5}
                placeholder="Paste the exact answer you committed…"
              />
            </Field>
            <Field label="Original salt (0x… 32 bytes)">
              <Input
                value={revealSalt}
                onChange={(e) => setRevealSalt(e.target.value)}
                placeholder="0x…"
                className="font-mono"
              />
            </Field>
            <Button
              type="submit"
              disabled={
                !isConnected ||
                !hasCommitted ||
                myRevealed ||
                !revealAnswer.trim() ||
                !isBytes32(revealSalt) ||
                revealTx.isBusy
              }
              className="w-full"
            >
              {myRevealed ? "Already revealed" : revealTx.isBusy ? "Revealing…" : "Reveal answer"}
            </Button>
            {!stored && hasCommitted && (
              <p className="text-xs text-amber-300">
                No saved answer in this browser — paste the exact answer + salt you committed with.
              </p>
            )}
            <TxStatus
              state={revealTx.state}
              error={revealTx.error}
              hash={revealTx.hash}
              explorerBase={explorerBase}
            />
          </form>
        )}
      </CardBody>
    </Card>
  );
}
