// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MiniGenesisStream is ReentrancyGuard {
    enum Phase {
        Waiting,
        Contribution,
        Protection,
        Ended
    }

    struct UserInfo {
        uint256 contributedDot;
        uint256 rewardDebt;
        uint256 accruedMini;
    }

    event GenesisStarted(
        uint256 indexed startBlock,
        uint256 contributionEndBlock,
        uint256 emissionEndBlock,
        address indexed firstContributor,
        uint256 firstContribution
    );
    event Contributed(address indexed contributor, uint256 amount);
    event LuckyRootCreditConfigured(uint256 allocation, uint256 contributionBlocks);

    error ZeroAddress();
    error InvalidConfiguration();
    error FirstContributionTooSmall();
    error ContributionTooSmall();
    error ContributionClosed();
    error TreasuryTransferFailed();

    uint256 public constant ACC_PRECISION = 1e36;
    address public immutable treasury;
    uint256 public immutable genesisAllocation;
    uint256 public immutable luckyRootAllocation;
    uint256 public immutable contributionBlocks;
    uint256 public immutable protectionBlocks;
    uint256 public immutable totalEmissionBlocks;
    uint256 public immutable firstContributionMinimum;
    uint256 public immutable subsequentContributionMinimumExclusive;

    uint256 public startBlock;
    uint256 public contributionEndBlock;
    uint256 public emissionEndBlock;
    uint256 public lastSettledBlock;
    uint256 public totalRaisedDot;
    uint256 public contributorCount;
    uint256 public accMiniPerDot;

    mapping(address account => UserInfo info) private users;

    constructor(
        address treasury_,
        uint256 genesisAllocation_,
        uint256 luckyRootAllocation_,
        uint256 contributionBlocks_,
        uint256 protectionBlocks_,
        uint256 firstContributionMinimum_,
        uint256 subsequentContributionMinimumExclusive_
    ) {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (
            genesisAllocation_ == 0 || luckyRootAllocation_ == 0 || contributionBlocks_ == 0
                || protectionBlocks_ == 0 || firstContributionMinimum_ == 0
                || subsequentContributionMinimumExclusive_ == 0
                || firstContributionMinimum_ <= subsequentContributionMinimumExclusive_
        ) revert InvalidConfiguration();

        treasury = treasury_;
        genesisAllocation = genesisAllocation_;
        luckyRootAllocation = luckyRootAllocation_;
        contributionBlocks = contributionBlocks_;
        protectionBlocks = protectionBlocks_;
        totalEmissionBlocks = contributionBlocks_ + protectionBlocks_;
        firstContributionMinimum = firstContributionMinimum_;
        subsequentContributionMinimumExclusive = subsequentContributionMinimumExclusive_;
        emit LuckyRootCreditConfigured(luckyRootAllocation_, contributionBlocks_);
    }

    /// @notice Planned Lucky Root Credit after a number of contribution blocks.
    /// @dev The input is capped at contributionBlocks and the cumulative-difference
    /// schedule guarantees that all block allocations sum exactly to the configured total.
    function cumulativeLuckyRootCredit(uint256 elapsedContributionBlocks)
        public
        view
        returns (uint256)
    {
        uint256 elapsed = elapsedContributionBlocks > contributionBlocks
            ? contributionBlocks
            : elapsedContributionBlocks;
        return Math.mulDiv(luckyRootAllocation, elapsed, contributionBlocks);
    }

    /// @notice Planned Lucky Root Credit for a zero-based elapsed contribution block.
    function luckyRootCreditForElapsedBlock(uint256 elapsedBlock) external view returns (uint256) {
        if (elapsedBlock >= contributionBlocks) return 0;
        return cumulativeLuckyRootCredit(elapsedBlock + 1) - cumulativeLuckyRootCredit(elapsedBlock);
    }

    function contribute() external payable nonReentrant {
        bool isFirst = startBlock == 0;
        if (isFirst) {
            if (msg.value < firstContributionMinimum) revert FirstContributionTooSmall();

            startBlock = block.number;
            contributionEndBlock = block.number + contributionBlocks;
            emissionEndBlock = block.number + totalEmissionBlocks;
            lastSettledBlock = block.number;

            emit GenesisStarted(
                startBlock, contributionEndBlock, emissionEndBlock, msg.sender, msg.value
            );
        } else {
            if (block.number >= contributionEndBlock) revert ContributionClosed();
            if (msg.value <= subsequentContributionMinimumExclusive) {
                revert ContributionTooSmall();
            }
        }

        _updateGlobal();
        _accrue(msg.sender);

        UserInfo storage user = users[msg.sender];
        if (user.contributedDot == 0) ++contributorCount;
        user.contributedDot += msg.value;
        totalRaisedDot += msg.value;
        user.rewardDebt += Math.mulDiv(msg.value, accMiniPerDot, ACC_PRECISION, Math.Rounding.Ceil);

        emit Contributed(msg.sender, msg.value);

        // slither-disable-next-line low-level-calls
        (bool success,) = treasury.call{ value: msg.value }("");
        if (!success) revert TreasuryTransferFailed();
    }

    function phase() external view returns (Phase) {
        // slither-disable-next-line dangerous-strict-equalities
        if (startBlock == 0) return Phase.Waiting;
        if (block.number < contributionEndBlock) return Phase.Contribution;
        if (block.number < emissionEndBlock) return Phase.Protection;
        return Phase.Ended;
    }

    function pendingMini(address account) public view returns (uint256) {
        UserInfo storage user = users[account];
        uint256 accumulated =
            Math.mulDiv(user.contributedDot, _previewAccMiniPerDot(), ACC_PRECISION);
        uint256 unsettled = accumulated > user.rewardDebt ? accumulated - user.rewardDebt : 0;
        return user.accruedMini + unsettled;
    }

    function emittedMini() public view returns (uint256) {
        // slither-disable-next-line dangerous-strict-equalities
        if (startBlock == 0 || block.number <= startBlock) return 0;
        return _cumulativeEmission(block.number - startBlock);
    }

    function protectionEmissionMini() public view returns (uint256) {
        return genesisAllocation - _cumulativeEmission(contributionBlocks);
    }

    function userInfo(address account) external view returns (UserInfo memory) {
        return users[account];
    }

    function _updateGlobal() internal {
        // slither-disable-next-line dangerous-strict-equalities
        if (startBlock == 0) return;
        uint256 target = Math.min(block.number, emissionEndBlock);
        if (target <= lastSettledBlock) return;

        uint256 newEmission = _cumulativeEmission(target - startBlock)
            - _cumulativeEmission(lastSettledBlock - startBlock);
        accMiniPerDot += Math.mulDiv(newEmission, ACC_PRECISION, totalRaisedDot);
        lastSettledBlock = target;
    }

    function _previewAccMiniPerDot() internal view returns (uint256 currentAcc) {
        currentAcc = accMiniPerDot;
        // slither-disable-next-line dangerous-strict-equalities
        if (startBlock == 0) return currentAcc;
        uint256 target = Math.min(block.number, emissionEndBlock);
        if (target <= lastSettledBlock) return currentAcc;

        uint256 newEmission = _cumulativeEmission(target - startBlock)
            - _cumulativeEmission(lastSettledBlock - startBlock);
        return currentAcc + Math.mulDiv(newEmission, ACC_PRECISION, totalRaisedDot);
    }

    function _accrue(address account) internal {
        UserInfo storage user = users[account];
        uint256 accumulated = Math.mulDiv(user.contributedDot, accMiniPerDot, ACC_PRECISION);
        if (accumulated > user.rewardDebt) {
            user.accruedMini += accumulated - user.rewardDebt;
            user.rewardDebt = accumulated;
        }
    }

    function _cumulativeEmission(uint256 elapsedBlocks) internal view returns (uint256) {
        uint256 capped = elapsedBlocks > totalEmissionBlocks ? totalEmissionBlocks : elapsedBlocks;
        return Math.mulDiv(genesisAllocation, capped, totalEmissionBlocks);
    }
}
