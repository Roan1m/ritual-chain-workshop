import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther, toHex, getAddress } from "viem";

const { viem } = await network.connect();

// Stand-in ECIES ciphertext blobs (opaque bytes — the contract never decrypts them).
const CT_A = toHex(new Uint8Array(Array.from({ length: 80 }, (_, i) => (i * 7 + 3) % 256)));
const CT_B = toHex(new Uint8Array(Array.from({ length: 96 }, (_, i) => (i * 5 + 11) % 256)));
const SIG = toHex(new Uint8Array(65).fill(7));

describe("SealedAIJudge (Obscura advanced — encrypted submissions)", () => {
  let judge: any;
  let publicClient: any;
  let testClient: any;
  let owner: any, alice: any, bob: any;
  let bountyId: bigint;
  let subDeadline: bigint;

  before(async () => {
    publicClient = await viem.getPublicClient();
    testClient = await viem.getTestClient();
    [owner, alice, bob] = await viem.getWalletClients();
  });

  beforeEach(async () => {
    judge = await viem.deployContract("SealedAIJudge");
    const now = (await publicClient.getBlock()).timestamp;
    subDeadline = now + 1000n;
    await judge.write.createBounty(["Sealed bounty", "Best private answer", subDeadline], {
      value: parseEther("1"),
    });
    bountyId = 1n;
  });

  async function warpTo(ts: bigint) {
    await testClient.setNextBlockTimestamp({ timestamp: ts });
    await testClient.mine({ blocks: 1 });
  }

  it("stores only ciphertext — there is no plaintext field", async () => {
    await judge.write.submitSealed([bountyId, CT_A, SIG], { account: alice.account });
    // getSealed -> [submitter, ciphertext, signature]; no plaintext is ever returned
    const sealed = await judge.read.getSealed([bountyId, 0n]);
    assert.equal(getAddress(sealed[0]), getAddress(alice.account.address));
    assert.equal(sealed[1], CT_A);
    assert.equal(sealed[2], SIG);
    const bounty = await judge.read.getBounty([bountyId]);
    assert.equal(bounty[7], 1n); // submissionCount
  });

  it("rejects an empty ciphertext", async () => {
    await assert.rejects(
      judge.write.submitSealed([bountyId, "0x", SIG], { account: alice.account }),
      /empty ciphertext/,
    );
  });

  it("rejects a second submission from the same address", async () => {
    await judge.write.submitSealed([bountyId, CT_A, SIG], { account: alice.account });
    await assert.rejects(
      judge.write.submitSealed([bountyId, CT_B, SIG], { account: alice.account }),
      /already submitted/,
    );
  });

  it("rejects submissions after the deadline", async () => {
    await warpTo(subDeadline + 1n);
    await assert.rejects(
      judge.write.submitSealed([bountyId, CT_A, SIG], { account: bob.account }),
      /submissions closed/,
    );
  });

  it("getSubmissionIndex reports presence on-chain", async () => {
    await judge.write.submitSealed([bountyId, CT_A, SIG], { account: alice.account });
    const mine = await judge.read.getSubmissionIndex([bountyId, alice.account.address]);
    assert.equal(mine[0], true);
    assert.equal(mine[1], 0n);
    const none = await judge.read.getSubmissionIndex([bountyId, bob.account.address]);
    assert.equal(none[0], false);
  });

  it("getCiphertexts returns every blob in order", async () => {
    await judge.write.submitSealed([bountyId, CT_A, SIG], { account: alice.account });
    await judge.write.submitSealed([bountyId, CT_B, SIG], { account: bob.account });
    const cts = await judge.read.getCiphertexts([bountyId]);
    assert.equal(cts.length, 2);
    assert.equal(cts[0], CT_A);
    assert.equal(cts[1], CT_B);
  });

  it("rejects judging while submissions are still open", async () => {
    await judge.write.submitSealed([bountyId, CT_A, SIG], { account: alice.account });
    await assert.rejects(
      judge.write.judgeAll([bountyId, "0x"], { account: owner.account }),
      /submissions still open/,
    );
  });

  it("rejects finalize before judging", async () => {
    await judge.write.submitSealed([bountyId, CT_A, SIG], { account: alice.account });
    await assert.rejects(
      judge.write.finalizeWinner([bountyId, 0n], { account: owner.account }),
      /not judged yet/,
    );
  });

  it("rejects judging by a non-owner", async () => {
    await warpTo(subDeadline + 1n);
    await assert.rejects(
      judge.write.judgeAll([bountyId, "0x"], { account: alice.account }),
      /not bounty owner/,
    );
  });
});
