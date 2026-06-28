<div align="center">

# ◐ Obscura — Blind Bounty Judge

*Submissions stay **obscured** until the verdict.*

A privacy-preserving bounty on **Ritual Chain**: entrants commit a hash, reveal after the deadline, and Ritual AI ranks every revealed answer in one batch — so nothing is readable, or copyable, before judging.

![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-0.8-1c1917?logo=solidity)
![Ritual](https://img.shields.io/badge/Ritual-chain%201979-f59e0b)

**[▶ Live demo](https://roan1m.github.io/ritual-chain-workshop/)**

</div>

---

## The idea

The original workshop judge stored answers in plaintext the moment they were submitted. In a contest where only one entry wins, a latecomer can simply read the best answer, improve on it, and resubmit. Obscura removes that edge: during the submission window the chain holds **only a commitment hash** — the answer itself is obscured until everyone's window has closed.

## Lifecycle

```
commit (hash) ─▶ reveal (answer+salt) ─▶ judge (1 batch AI) ─▶ finalize (pay)
```

1. **Commit** — `submitCommitment(bountyId, commitment)` where
   `commitment = keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId))`. Only the hash is on-chain.
2. **Reveal** — after the submission deadline, `revealAnswer(bountyId, answer, salt)`; the contract re-derives the hash and must match. Binding to `msg.sender` + `bountyId` stops replay/reuse.
3. **Judge** — `judgeAll(bountyId, llmInput)` (owner, after the reveal deadline): one batched Ritual AI call over the revealed answers.
4. **Finalize** — `finalizeWinner(bountyId, winnerIndex)` (owner): pays exactly one revealed winner.

## Built differently

This is a sibling to other takes on the same brief, but intentionally its own thing:

- **Frontend:** **Vite + React** SPA (not Next.js) — `wagmi` + `viem` + Tailwind v4, a serif (Fraunces) editorial look, and a "redacted dossier" aesthetic.
- **Contract niceties:** a stored **`revealedCount`** (no loop at judge time) and an on-chain **`getSubmissionIndex(bountyId, addr)`** so the UI knows if a wallet has committed without scanning — the reveal button stays disabled until there's actually something to reveal.
- **Salt UX:** the salt is shown and editable at commit (with a live commitment preview), so it's never a hidden value you can lose.

## On-chain (Ritual testnet · chain 1979)

| | |
|---|---|
| Contract `AIJudge` | [`0xc6cbA50A1021820E988f59A6F30f133e8ec6bb6b`](https://explorer.ritualfoundation.org/address/0xc6cbA50A1021820E988f59A6F30f133e8ec6bb6b) |
| Deploy tx | `0x2e5d2dc6872abbfbac0a1c174ea84ed9717bd825e77a180747275379484e98a7` |
| Deployer | `0x3220668033b77521124a8D7572bE2A311cB4af7f` |

> ⚠️ Ritual reports `block.timestamp` in **milliseconds**, so all deadlines use millisecond timestamps.

## Repository layout

```
.
├── ARCHITECTURE.md                 # public/hidden · on/off-chain · advanced design
├── hardhat/
│   ├── contracts/AIJudge.sol       # commit-reveal + revealedCount + getSubmissionIndex
│   └── test/AIJudge.ts             # 12 passing reveal-case tests
└── web/                            # Vite + React SPA
    ├── index.html · vite.config.ts
    └── src/
        ├── App.tsx                 # header · hero · lifecycle · compose
        ├── config.ts               # chain + contract + wagmi
        ├── ui.tsx · useTx.ts       # primitives + tx-state hook
        ├── components/             # Connect · CreateBounty · LoadBounty · BountyView
        ├── lib/                    # ritualLlm · aiReview · bounty · format · utils
        └── abi/AIJudge.ts
```

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173

# build the static site
npm run build      # -> web/dist

# contract tests (reveal cases)
cd ../hardhat
npm install
npx hardhat test   # 12 passing
```

Contract address is read from `VITE_CONTRACT_ADDRESS` (falls back to the deployed one above).
See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the public/hidden + on-chain/off-chain breakdown and the advanced Ritual-native design.

## Design notes

- **Hash-only commits** — no answer text on-chain until reveal, after the commit window closes.
- **Collision-safe packing** — only `answer` is dynamic in `abi.encodePacked(answer, salt, sender, bountyId)` and it leads; trailing fields are fixed-width.
- **One batch verdict** — `judgeAll` makes a single LLM call over all revealed answers, never one per entry.
- **Human-in-the-loop** — `finalizeWinner` is owner-only; funds are zeroed before the external call (checks-effects-interactions).

## Reflection — public vs hidden, AI vs human

*What should be public?* The rules of the game — prompt, rubric, deadlines, and reward — together with every submission's commitment hash, so anyone can audit that the contest was fair and that no entry was altered after the fact. *What should stay hidden?* The answer text during the submission window, because publishing it early lets latecomers copy and out-do earlier entries — the exact flaw this system removes. Once the window closes, answers are revealed and become public, so the judging itself stays transparent and re-checkable. *AI vs human?* The AI is well suited to the first pass: it reads every revealed answer against the rubric and ranks them in a single batch, quickly and without favouritism. But rubrics are interpretive and real money is at stake, so a human owner keeps the final say — ratifying the AI's recommendation and releasing the reward. In short, the chain enforces timing and fairness, the AI recommends, and a human is accountable for the decision. That separation of duties is what keeps the process both automated and trustworthy.

---

<div align="center"><sub>Obscura · commit-reveal on Ritual, with batched AI judging.</sub></div>
