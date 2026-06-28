"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Abi, Address, TransactionReceipt } from "viem";

/**
 * Structural shape of a contract write. Kept deliberately simple: wagmi's exact
 * mutate-params type is a large discriminated union that infers poorly when
 * forwarded through a wrapper, so we accept this and cast once at the boundary.
 */
type WriteParams = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  chainId?: number;
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
};

type WagmiWriteParams = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

export type TxState =
  | "idle"
  | "wallet" // waiting for the user to confirm in their wallet
  | "pending" // submitted, waiting for on-chain confirmation
  | "confirmed"
  | "failed";

export type WriteTx = ReturnType<typeof useWriteTx>;

/** Turn an unknown thrown value into a short, human-friendly message. */
function describeError(err: unknown): string {
  if (!err) return "Transaction failed.";
  const anyErr = err as { shortMessage?: string; message?: string };
  const msg = anyErr.shortMessage || anyErr.message || String(err);
  if (/user rejected|denied|rejected the request/i.test(msg)) {
    return "Request rejected in wallet.";
  }
  // Surface known contract revert reasons clearly.
  const known = [
    "submissions closed",
    "reveal not open",
    "reveal closed",
    "reveal phase not over",
    "reveal still open",
    "no commitment",
    "commitment mismatch",
    "invalid reveal",
    "already committed",
    "already revealed",
    "already judged",
    "already finalized",
    "not bounty owner",
    "winner not revealed",
    "no revealed",
  ];
  const low = msg.toLowerCase();
  for (const k of known) {
    if (low.includes(k)) return k.charAt(0).toUpperCase() + k.slice(1) + ".";
  }
  // A failed gas estimate (huge gas / block-limit) almost always means the tx
  // would revert — translate the cryptic wallet message into a useful hint.
  if (
    /exceeds the limit allowed for the block|gas required exceeds|intrinsic gas|cannot estimate gas|unpredictable_gas|execution reverted/i.test(
      msg,
    )
  ) {
    return "This transaction would revert on-chain — check the phase/timing (deadline passed?) or that this wallet has a matching commitment.";
  }
  // Keep it to the first line so we don't dump a stack into the UI.
  return msg.split("\n")[0];
}

/**
 * Wraps wagmi's write + receipt hooks into a single clear state machine:
 * idle → wallet → pending → confirmed | failed.
 *
 * `run(params)` returns the tx hash (or throws). `onConfirmed(receipt)` fires
 * once when the receipt lands — handy for refetching reads or reading logs.
 */
export function useWriteTx(onConfirmed?: (receipt: TransactionReceipt) => void) {
  const {
    data: hash,
    reset: resetWrite,
    isPending: isWalletPending,
    mutateAsync: writeContractAsync,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  // Local error from the submit step. The receipt error is derived (below),
  // so we never copy it into state from an effect.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notifiedRef = useRef(false);

  // Fire onConfirmed exactly once per confirmation. Calling a callback (not
  // setState) inside the effect keeps render pure and lint-clean.
  useEffect(() => {
    if (isConfirmed && receipt && !notifiedRef.current) {
      notifiedRef.current = true;
      onConfirmed?.(receipt);
    }
  }, [isConfirmed, receipt, onConfirmed]);

  const error =
    submitError ?? (isReceiptError && receiptError ? describeError(receiptError) : null);

  const state: TxState = error
    ? "failed"
    : isConfirmed
      ? "confirmed"
      : isConfirming
        ? "pending"
        : submitting || isWalletPending
          ? "wallet"
          : "idle";

  const run = useCallback(
    async (params: WriteParams) => {
      setSubmitError(null);
      notifiedRef.current = false;
      setSubmitting(true);
      try {
        return await writeContractAsync(params as WagmiWriteParams);
      } catch (e) {
        setSubmitError(describeError(e));
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    resetWrite();
    setSubmitError(null);
    notifiedRef.current = false;
    setSubmitting(false);
  }, [resetWrite]);

  return {
    run,
    reset,
    state,
    hash,
    receipt,
    error,
    isBusy: state === "wallet" || state === "pending",
    isConfirmed,
  };
}
