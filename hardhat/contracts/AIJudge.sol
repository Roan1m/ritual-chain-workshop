// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function depositFor(address user, uint256 lockDuration) external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address) external view returns (uint256);
    function lockUntil(address) external view returns (uint256);
}

/// @title AIJudge — Obscura blind bounty judge (commit-reveal)
/// @notice Submissions are blind during the commit window: participants post only
///         a commitment hash, so no one can read or clone an earlier entry. After
///         the submission deadline they reveal answer + salt, the contract verifies
///         keccak256(answer, salt, msg.sender, bountyId), and only verified reveals
///         are judged by Ritual AI in one batch. A human owner finalizes the winner.
/// @dev    Improvements over a plain commit-reveal: a stored `revealedCount` (no
///         O(n) loop at judge time) and an on-chain `getSubmissionIndex` lookup so a
///         client can tell whether a wallet has committed without scanning.
contract AIJudge is PrecompileConsumer {
    uint256 public constant MAX_SUBMISSIONS = 10;
    uint256 public constant MAX_ANSWER_LENGTH = 2_000;

    uint256 public nextBountyId = 1;

    IRitualWallet wallet =
        IRitualWallet(0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948);

    struct Submission {
        address submitter;
        bytes32 commitment; // keccak256(abi.encodePacked(answer, salt, submitter, bountyId))
        bool revealed;
        string answer; // empty until revealed
    }

    struct Bounty {
        address owner;
        string title;
        string rubric;
        uint256 reward;
        uint256 submissionDeadline; // commit window ends here
        uint256 revealDeadline; // reveal window ends here
        bool judged;
        bool finalized;
        bytes aiReview;
        uint256 winnerIndex;
        uint256 revealedCount; // number of revealed submissions (eligible to judge)
        Submission[] submissions;
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
        uint256 submissionDeadline,
        uint256 revealDeadline
    );
    event CommitmentSubmitted(
        uint256 indexed bountyId,
        uint256 indexed index,
        address indexed submitter,
        bytes32 commitment
    );
    event AnswerRevealed(
        uint256 indexed bountyId,
        uint256 indexed index,
        address indexed submitter
    );
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

    function createBounty(
        string calldata title,
        string calldata rubric,
        uint256 submissionDeadline,
        uint256 revealDeadline
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "reward required");
        require(submissionDeadline > block.timestamp, "submission deadline in past");
        require(revealDeadline > submissionDeadline, "reveal must follow submission");

        bountyId = nextBountyId++;
        Bounty storage b = bounties[bountyId];
        b.owner = msg.sender;
        b.title = title;
        b.rubric = rubric;
        b.reward = msg.value;
        b.submissionDeadline = submissionDeadline;
        b.revealDeadline = revealDeadline;
        b.winnerIndex = type(uint256).max;

        emit BountyCreated(bountyId, msg.sender, title, msg.value, submissionDeadline, revealDeadline);
    }

    /// @notice Phase 1 — commit: publish only a hash. Nothing about the answer leaks.
    function submitCommitment(
        uint256 bountyId,
        bytes32 commitment
    ) external bountyExists(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp < b.submissionDeadline, "submissions closed");
        require(!b.judged, "already judged");
        require(commitment != bytes32(0), "empty commitment");
        require(b.slotPlusOne[msg.sender] == 0, "already committed");
        require(b.submissions.length < MAX_SUBMISSIONS, "too many submissions");

        b.submissions.push(
            Submission({submitter: msg.sender, commitment: commitment, revealed: false, answer: ""})
        );
        uint256 index = b.submissions.length - 1;
        b.slotPlusOne[msg.sender] = index + 1;
        emit CommitmentSubmitted(bountyId, index, msg.sender, commitment);
    }

    /// @notice Phase 2 — reveal: prove your answer + salt against the commitment.
    function revealAnswer(
        uint256 bountyId,
        string calldata answer,
        bytes32 salt
    ) external bountyExists(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp >= b.submissionDeadline, "reveal not open");
        require(block.timestamp < b.revealDeadline, "reveal closed");
        require(!b.judged, "already judged");
        require(bytes(answer).length <= MAX_ANSWER_LENGTH, "answer too long");

        uint256 slot = b.slotPlusOne[msg.sender];
        require(slot != 0, "no commitment");
        Submission storage s = b.submissions[slot - 1];
        require(!s.revealed, "already revealed");

        bytes32 expected = keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId));
        require(expected == s.commitment, "invalid reveal");

        s.revealed = true;
        s.answer = answer;
        b.revealedCount += 1;
        emit AnswerRevealed(bountyId, slot - 1, msg.sender);
    }

    /// @notice Phase 3 — judge: one batched LLM call over the revealed answers.
    function judgeAll(
        uint256 bountyId,
        bytes calldata llmInput
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp >= b.revealDeadline, "reveal not finished");
        require(!b.judged, "already judged");
        require(!b.finalized, "already finalized");
        require(b.revealedCount > 0, "no revealed answers");

        bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
        (bool hasError, bytes memory completionData, , string memory errorMessage, ) =
            abi.decode(output, (bool, bytes, bytes, string, ConvoHistory));
        require(!hasError, errorMessage);

        b.judged = true;
        b.aiReview = completionData;
        emit AllAnswersJudged(bountyId, completionData);
    }

    /// @notice Phase 4 — finalize: pay the (revealed) winner.
    function finalizeWinner(
        uint256 bountyId,
        uint256 winnerIndex
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage b = bounties[bountyId];
        require(b.judged, "not judged yet");
        require(!b.finalized, "already finalized");
        require(winnerIndex < b.submissions.length, "invalid index");
        require(b.submissions[winnerIndex].revealed, "winner not revealed");

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
            uint256 revealDeadline,
            bool judged,
            bool finalized,
            uint256 submissionCount,
            uint256 revealedCount,
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
            b.revealDeadline,
            b.judged,
            b.finalized,
            b.submissions.length,
            b.revealedCount,
            b.winnerIndex,
            b.aiReview
        );
    }

    function getSubmission(
        uint256 bountyId,
        uint256 index
    )
        external
        view
        bountyExists(bountyId)
        returns (address submitter, bytes32 commitment, bool revealed, string memory answer)
    {
        Bounty storage b = bounties[bountyId];
        require(index < b.submissions.length, "invalid index");
        Submission storage s = b.submissions[index];
        return (s.submitter, s.commitment, s.revealed, s.answer);
    }

    /// @notice On-chain lookup so a client can tell if a wallet has committed
    ///         (and where) without scanning every submission.
    function getSubmissionIndex(
        uint256 bountyId,
        address submitter
    ) external view bountyExists(bountyId) returns (bool exists, uint256 index) {
        uint256 slot = bounties[bountyId].slotPlusOne[submitter];
        if (slot == 0) return (false, 0);
        return (true, slot - 1);
    }
}
