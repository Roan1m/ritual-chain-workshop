# Obscura — Architecture Note

This note explains what Obscura stores where, the trust model of the implemented
**commit-reveal** track, and a design for the **advanced Ritual-native** track.

---

## 1. Implemented — Commit-Reveal

### Lifecycle & what is written at each step

| Step | Call | What lands on-chain |
|---|---|---|
| Commit | `submitCommitment(bountyId, commitment)` | a single `bytes32` hash per address — **no answer text** |
| Reveal | `revealAnswer(bountyId, answer, salt)` | the plaintext answer, after the contract re-derives and matches the hash |
| Judge | `judgeAll(bountyId, llmInput)` | the AI review blob (one batched call), `judged = true` |
| Finalize | `finalizeWinner(bountyId, winnerIndex)` | winner index, reward transferred, `finalized = true` |

### Public vs hidden

- **Always public:** bounty metadata (title, rubric, submission/reveal deadlines, reward),
  every commitment hash, submitter addresses, and the final ranking + winner.
- **Hidden during the submission window:** the answer text. Only
  `keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId))` is on-chain — a salted,
  preimage-resistant hash bound to the submitter and the bounty.
- **Public after reveal:** the answers, so judging is transparent and anyone can re-check it.

### On-chain vs off-chain

- **On-chain:** commitment hashes, revealed answers, the reward escrow, the AI review blob,
  and the ranking/winner.
- **Off-chain:** the `answer` + `salt` before reveal — held by the participant (the web app
  caches them in `localStorage` so they aren't lost). LLM inference runs in Ritual's
  precompile/executor, not in the contract.

### Contract storage

```
bounties[bountyId]                = { owner, title, rubric, submissionDeadline,
                                      revealDeadline, reward, submissionCount,
                                      revealedCount, judged, finalized,
                                      winnerIndex, aiReview }
submissions[bountyId][index]      = { submitter, commitment, revealed, answer }
getSubmissionIndex(bountyId,addr) -> (exists, index)   // O(1) "have I committed?"
```

### Trust model / guarantees

- **No early copying** — the hash hides the answer until the window closes.
- **Binding** — including `msg.sender` + `bountyId` in the preimage means a commitment can't
  be replayed by another address or reused across bounties.
- **One commit, one reveal** — duplicate commits (`already committed`) and double reveals
  (`already revealed`) are rejected; a reveal must match its commitment (`invalid reveal`).
- **Batch judging** — `judgeAll` makes a **single** LLM call over all revealed answers, never
  one per entry.
- **Human gate + safe payout** — `judgeAll`/`finalizeWinner` are owner-only, and the reward is
  zeroed before the external transfer (checks-effects-interactions).

These paths are covered by `hardhat/test/AIJudge.ts` (12 passing cases: valid reveal, wrong
answer, wrong salt, reveal-too-early, reveal-too-late, no-commitment, double-reveal,
late-commit, duplicate-commit, premature-judge, and the index lookup).

---

## 2. Implemented — Ritual-Native Sealed Submissions (advanced)

> **Deployed:** `SealedAIJudge` at [`0xf69Ebb5220200d5E7CF44DA4bB2D381F0F67DD92`](https://explorer.ritualfoundation.org/address/0xf69Ebb5220200d5E7CF44DA4bB2D381F0F67DD92)
> on Ritual (chain 1979, tx `0x48d668c584787d5937a8731e2fa8971aefbefa14e2df2243dd901139da42539d`).
> Client encryption: `web/src/lib/ritualSecrets.ts`. Tests: `hardhat/test/SealedAIJudge.ts` (9 passing).

**Goal:** answers stay hidden *even from the chain* until judging — removing the public reveal
phase entirely — using Ritual's TEE-backed execution.

### Where plaintext answers exist

Only in two places: **(a)** the entrant's browser while they write the answer, and **(b)**
inside the Ritual **TEE** during batch judging. Plaintext never appears in public calldata or
public contract state.

### On-chain vs off-chain

- **On-chain:** one ciphertext handle (or commitment) per submission — the answer encrypted to
  the bounty executor's TEE public key — plus bounty metadata and the final ranking.
- **In-enclave / off-chain:** the plaintext answers, decrypted **only inside the TEE** at
  judging time. The decryption key is a Ritual-managed secret available solely to the enclave.

### How the LLM receives submissions for batch judging

1. Each entrant encrypts their answer to the bounty's executor public key and submits the
   ciphertext (or a pointer to off-chain blob storage).
2. After the deadline the owner triggers `judgeAll`. The Ritual executor, running in a TEE,
   gathers all ciphertexts, **decrypts them in-enclave**, assembles **one** batched prompt
   (rubric + every answer), calls the LLM **once**, and writes back the ranking/winner — with
   an attestation that the work ran in a genuine enclave.
3. Plaintext is discarded inside the enclave; only the ranking leaves it.

### In this repo

| Step | Where |
|---|---|
| Entrant encrypts answer to the executor key (ECIES, 12-byte nonce) | `encryptAnswer()` in `ritualSecrets.ts` |
| Ciphertext stored on-chain — no plaintext field exists | `SealedAIJudge.submitSealed(bountyId, ciphertext, signature)` |
| Owner assembles the batched request (`encryptedSecrets`, `piiEnabled=true`) | `buildSealedJudgeInput()` in `ritualSecrets.ts` |
| TEE decrypts, substitutes `{{ANSWER_<addr>}}`, judges once | `SealedAIJudge.judgeAll(bountyId, llmInput)` → LLM precompile `0x0802` |
| Owner pays the winning entrant | `SealedAIJudge.finalizeWinner(bountyId, winnerIndex)` |

The plaintext is wrapped as `{"ANSWER_<submitter>": answer}` and referenced by a
`{{ANSWER_<submitter>}}` placeholder, so the enclave substitutes each answer into the
single batched prompt. The ECIES encrypt → decrypt round-trip is verified against `eciesjs`.

### Trade-offs vs commit-reveal

- **Upside:** no reveal step (no "forgot to reveal" losses), and answers never become public
  unless the bounty chooses to publish them.
- **Cost:** a stronger trust assumption (TEE integrity + key management) and Ritual-specific
  encrypted-input tooling; a public reveal is simpler to audit.

> Both tracks are **implemented and deployed**: commit-reveal (`AIJudge`) and Ritual-native
> sealed submissions (`SealedAIJudge`), each with passing tests. The one part that depends on
> live Ritual infrastructure is the in-enclave decryption + batched inference at `judgeAll`
> time (a funded RitualWallet + a registered executor); the encryption, on-chain storage,
> access control, and request encoding are exercised and verified here.
