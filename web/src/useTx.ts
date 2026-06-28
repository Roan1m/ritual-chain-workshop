import { useCallback, useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { TransactionReceipt } from "viem";

export type TxState = "idle" | "wallet" | "pending" | "confirmed" | "failed";

function describe(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string };
  const m = e?.shortMessage || e?.message || String(err);
  if (/user rejected|denied|rejected the request/i.test(m)) return "Rejected in wallet.";
  const known = [
    "submissions closed",
    "reveal not open",
    "reveal closed",
    "reveal not finished",
    "no commitment",
    "invalid reveal",
    "already committed",
    "already revealed",
    "already judged",
    "already finalized",
    "not bounty owner",
    "winner not revealed",
    "no revealed answers",
  ];
  const low = m.toLowerCase();
  for (const k of known) if (low.includes(k)) return k[0].toUpperCase() + k.slice(1) + ".";
  if (/exceeds the limit allowed for the block|gas required exceeds|cannot estimate|execution reverted/i.test(m))
    return "Transaction would revert — check the phase/timing or your inputs.";
  return m.split("\n")[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WriteArgs = any;

export function useTx(onDone?: (r: TransactionReceipt) => void) {
  const { data: hash, writeContractAsync, isPending: walletPending } = useWriteContract();
  const {
    data: receipt,
    isLoading: confirming,
    isSuccess,
    isError,
    error: rcptErr,
  } = useWaitForTransactionReceipt({ hash });
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (isSuccess && receipt && !done.current) {
      done.current = true;
      onDone?.(receipt);
    }
  }, [isSuccess, receipt, onDone]);

  const error = submitErr ?? (isError && rcptErr ? describe(rcptErr) : null);
  const state: TxState = error
    ? "failed"
    : isSuccess
      ? "confirmed"
      : confirming
        ? "pending"
        : submitting || walletPending
          ? "wallet"
          : "idle";

  const run = useCallback(
    async (args: WriteArgs) => {
      setSubmitErr(null);
      done.current = false;
      setSubmitting(true);
      try {
        return await writeContractAsync(args);
      } catch (e) {
        setSubmitErr(describe(e));
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [writeContractAsync],
  );

  return { run, state, hash, error, isBusy: state === "wallet" || state === "pending" };
}
