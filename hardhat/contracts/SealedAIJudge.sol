// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

/// @title SealedAIJudge — Obscura advanced track (Ritual-native hidden submissions)
/// @notice Answers are **never** stored in plaintext on-chain and there is **no public
///         reveal phase**. Each entrant ECIES-encrypts their answer to the TEE
///         executor's public key (from TEEServiceRegistry) and submits only the
///         ciphertext. At judging time the owner calls `judgeAll` with an LLM request
///         whose `encryptedSecrets` carry those ciphertexts and `piiEnabled = true`;
///         the executor decrypts them *inside the enclave*, substitutes the
///         `{{ANSWER_i}}` placeholders, runs ONE batched inference, and redacts the
///         plaintext from the settled result. Plaintext exists only in the entrant's
///         browser and inside the TEE — never in calldata, state, or logs.
/// @dev    Mechanism per Ritual docs (Secrets & ECIES + LLM precompile 0x0802):
///         encryptedSecrets[] (field 1), secretSignatures[] (field 3), piiEnabled.
///         The contract stores opaque ciphertext + signature blobs and forwards a
///         pre-encoded `llmInput` to the precompile, mirroring AIJudge's plumbing.
contract SealedAIJudge is PrecompileConsumer {
    uint256 public constant MAX_SUBMISSIONS = 10;
    uint256 public constant MAX_CIPHERTEXT_BYTES = 8_000;

    uint256 public nextBountyId = 1;

    struct Sealed {
        address submitter;
        bytes ciphertext; // ECIES blob, decryptable only inside the TEE
        bytes signature; // EIP-191 signature over the ciphertext (secretSignatures)
    }

    struct Bounty {
        address owner;
        string title;
        string rubric;
        uint256 reward;
        uint256 submissionDeadline; // submissions close here; judging opens
        bool judged;
        bool finalized;
        bytes aiReview;
        uint256 winnerIndex;
        Sealed[] submissions;
        mapping(address => uint256) slotPlusOne; // submitter => index+1 (0 = none)
    }

    struct ConvoHistory {
        string storageType;
        string path;
        string secretsName;
    }

    mapping(uint256 => Bounty) internal bounties;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed owner,
        string title,
        uint256 reward,
        uint256 submissionDeadline
    );
    event SealedSubmitted(uint256 indexed bountyId, uint256 indexed index, address indexed submitter);
    event AllAnswersJudged(uint256 indexed bountyId, bytes aiReview);
    event WinnerFinalized(
        uint256 indexed bountyId,
        uint256 indexed winnerIndex,
        address indexed winner,
        uint256 reward
    );

    modifier onlyOwner(uint256 bountyId) {
        require(msg.sender == bounties[bountyId].owner, "not bounty owner");
        _;
    }
    modifier bountyExists(uint256 bountyId) {
        require(bounties[bountyId].owner != address(0), "bounty not found");
        _;
    }

    /// @notice Create a sealed bounty. Submissions close at `submissionDeadline`,
    ///         after which the owner can run the batched encrypted judging.
    function createBounty(
        string calldata title,
        string calldata rubric,
        uint256 submissionDeadline
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "reward required");
        require(submissionDeadline > block.timestamp, "submission deadline in past");

        bountyId = nextBountyId++;
        Bounty storage b = bounties[bountyId];
        b.owner = msg.sender;
        b.title = title;
        b.rubric = rubric;
        b.reward = msg.value;
        b.submissionDeadline = submissionDeadline;
        b.winnerIndex = type(uint256).max;

        emit BountyCreated(bountyId, msg.sender, title, msg.value, submissionDeadline);
    }

    /// @notice Submit an answer that is already ECIES-encrypted to the executor key.
    ///         The contract stores only ciphertext — it cannot read the answer.
    function submitSealed(
        uint256 bountyId,
        bytes calldata ciphertext,
        bytes calldata signature
    ) external bountyExists(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp < b.submissionDeadline, "submissions closed");
        require(!b.judged, "already judged");
        require(ciphertext.length > 0, "empty ciphertext");
        require(ciphertext.length <= MAX_CIPHERTEXT_BYTES, "ciphertext too long");
        require(b.slotPlusOne[msg.sender] == 0, "already submitted");
        require(b.submissions.length < MAX_SUBMISSIONS, "too many submissions");

        b.submissions.push(Sealed({submitter: msg.sender, ciphertext: ciphertext, signature: signature}));
        uint256 index = b.submissions.length - 1;
        b.slotPlusOne[msg.sender] = index + 1;
        emit SealedSubmitted(bountyId, index, msg.sender);
    }

    /// @notice Batched encrypted judging. `llmInput` is encoded off-chain with
    ///         encryptedSecrets = stored ciphertexts and piiEnabled = true, so the
    ///         TEE decrypts + substitutes {{ANSWER_i}} and judges in one call.
    function judgeAll(
        uint256 bountyId,
        bytes calldata llmInput
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp >= b.submissionDeadline, "submissions still open");
        require(!b.judged, "already judged");
        require(!b.finalized, "already finalized");
        require(b.submissions.length > 0, "no submissions");

        bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
        (bool hasError, bytes memory completionData, , string memory errorMessage, ) =
            abi.decode(output, (bool, bytes, bytes, string, ConvoHistory));
        require(!hasError, errorMessage);

        b.judged = true;
        b.aiReview = completionData;
        emit AllAnswersJudged(bountyId, completionData);
    }

    /// @notice Pay the winning entrant. The submitter address is public even though
    ///         the answer was sealed, so payout needs no decryption.
    function finalizeWinner(
        uint256 bountyId,
        uint256 winnerIndex
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(b.judged, "not judged yet");
        require(!b.finalized, "already finalized");
        require(winnerIndex < b.submissions.length, "invalid index");

        b.finalized = true;
        b.winnerIndex = winnerIndex;
        address winner = b.submissions[winnerIndex].submitter;
        uint256 reward = b.reward;
        b.reward = 0;
        (bool ok, ) = payable(winner).call{value: reward}("");
        require(ok, "payment failed");
        emit WinnerFinalized(bountyId, winnerIndex, winner, reward);
    }

    // ----------------------------------------------------------------- views

    function getBounty(
        uint256 bountyId
    )
        external
        view
        bountyExists(bountyId)
        returns (
            address owner,
            string memory title,
            string memory rubric,
            uint256 reward,
            uint256 submissionDeadline,
            bool judged,
            bool finalized,
            uint256 submissionCount,
            uint256 winnerIndex,
            bytes memory aiReview
        )
    {
        Bounty storage b = bounties[bountyId];
        return (
            b.owner,
            b.title,
            b.rubric,
            b.reward,
            b.submissionDeadline,
            b.judged,
            b.finalized,
            b.submissions.length,
            b.winnerIndex,
            b.aiReview
        );
    }

    /// @notice Read one sealed submission. There is no plaintext field by design.
    function getSealed(
        uint256 bountyId,
        uint256 index
    ) external view bountyExists(bountyId) returns (address submitter, bytes memory ciphertext, bytes memory signature) {
        Bounty storage b = bounties[bountyId];
        require(index < b.submissions.length, "invalid index");
        Sealed storage s = b.submissions[index];
        return (s.submitter, s.ciphertext, s.signature);
    }

    /// @notice All ciphertexts in order — convenient for assembling `encryptedSecrets`.
    function getCiphertexts(
        uint256 bountyId
    ) external view bountyExists(bountyId) returns (bytes[] memory ciphertexts) {
        Bounty storage b = bounties[bountyId];
        uint256 n = b.submissions.length;
        ciphertexts = new bytes[](n);
        for (uint256 i = 0; i < n; i++) {
            ciphertexts[i] = b.submissions[i].ciphertext;
        }
    }

    /// @notice O(1) "has this wallet submitted?" lookup.
    function getSubmissionIndex(
        uint256 bountyId,
        address submitter
    ) external view bountyExists(bountyId) returns (bool exists, uint256 index) {
        uint256 slot = bounties[bountyId].slotPlusOne[submitter];
        if (slot == 0) return (false, 0);
        return (true, slot - 1);
    }
}
