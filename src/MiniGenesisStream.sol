// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IMiniGenesisStream } from "./interfaces/IMiniGenesisStream.sol";

contract MiniGenesisStream is IMiniGenesisStream, ReentrancyGuard {
    uint256 public constant ACC_PRECISION = 1e36;
    uint256 private constant PRICE_PRECISION = 1e18;

    address public immutable treasury;
    address public immutable claimActivator;
    uint256 public immutable genesisAllocation;
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
    uint256 public totalClaimedMini;

    address public miniToken;
    bool public claimsEnabled;
    bool public finalized;

    mapping(address account => UserInfo info) private users;
    mapping(address account => bool contributed) private hasContributed;

    constructor(
        address treasury_,
        address claimActivator_,
        uint256 genesisAllocation_,
        uint256 contributionBlocks_,
        uint256 protectionBlocks_,
        uint256 firstContributionMinimum_,
        uint256 subsequentContributionMinimumExclusive_
    ) {
        if (treasury_ == address(0) || claimActivator_ == address(0)) revert ZeroAddress();
        if (
            genesisAllocation_ == 0 || contributionBlocks_ == 0 || protectionBlocks_ == 0
                || firstContributionMinimum_ == 0 || subsequentContributionMinimumExclusive_ == 0
                || firstContributionMinimum_ <= subsequentContributionMinimumExclusive_
        ) revert InvalidConfiguration();

        treasury = treasury_;
        claimActivator = claimActivator_;
        genesisAllocation = genesisAllocation_;
        contributionBlocks = contributionBlocks_;
        protectionBlocks = protectionBlocks_;
        totalEmissionBlocks = contributionBlocks_ + protectionBlocks_;
        firstContributionMinimum = firstContributionMinimum_;
        subsequentContributionMinimumExclusive = subsequentContributionMinimumExclusive_;
    }

    function contribute() external payable nonReentrant {
        bool isFirst = !started();
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
        user.contributedDot += msg.value;
        totalRaisedDot += msg.value;
        user.rewardDebt = Math.mulDiv(user.contributedDot, accMiniPerDot, ACC_PRECISION);

        if (!hasContributed[msg.sender]) {
            hasContributed[msg.sender] = true;
            ++contributorCount;
        }

        emit Contributed(msg.sender, msg.value, user.contributedDot, totalRaisedDot);

        (bool success,) = treasury.call{ value: msg.value }("");
        if (!success) revert TreasuryTransferFailed();
    }

    function finalize() external {
        if (!started()) revert NotStarted();
        if (block.number < emissionEndBlock) revert EmissionNotEnded();
        if (finalized) revert AlreadyFinalized();
        _finalize();
    }

    function phase() external view returns (Phase) {
        if (claimsEnabled) return Phase.Claims;
        if (!started()) return Phase.Waiting;
        if (block.number < contributionEndBlock) return Phase.Contribution;
        if (block.number < emissionEndBlock) return Phase.Protection;
        return Phase.Ended;
    }

    function started() public view returns (bool) {
        return startBlock != 0;
    }

    function pendingMini(address account) public view returns (uint256) {
        UserInfo storage user = users[account];
        uint256 currentAcc = _currentAccMiniPerDot();
        uint256 accumulated = Math.mulDiv(user.contributedDot, currentAcc, ACC_PRECISION);
        return user.accruedMini + accumulated - user.rewardDebt;
    }

    function cumulativeEmissionAt(uint256 blockNumber) public view returns (uint256) {
        if (!started() || blockNumber <= startBlock) return 0;
        uint256 elapsed = blockNumber - startBlock;
        if (elapsed > totalEmissionBlocks) elapsed = totalEmissionBlocks;
        return _cumulativeEmission(elapsed);
    }

    function emittedMini() public view returns (uint256) {
        return cumulativeEmissionAt(block.number);
    }

    function remainingMini() external view returns (uint256) {
        return genesisAllocation - emittedMini();
    }

    function protectionEmissionMini() public view returns (uint256) {
        return genesisAllocation - _cumulativeEmission(contributionBlocks);
    }

    function streamAveragePriceX18() external view returns (uint256) {
        uint256 emitted = emittedMini();
        return emitted == 0 ? 0 : Math.mulDiv(totalRaisedDot, PRICE_PRECISION, emitted);
    }

    function curveStartPriceX18() public view returns (uint256) {
        return Math.mulDiv(totalRaisedDot, PRICE_PRECISION, protectionEmissionMini());
    }

    function userInfo(address account) external view returns (UserInfo memory) {
        return users[account];
    }

    function activateClaims(address) external pure {
        revert ClaimsNotEnabled();
    }

    function claim() external pure {
        revert ClaimsNotEnabled();
    }

    function _updateGlobal() internal {
        if (!started()) return;
        uint256 target = Math.min(block.number, emissionEndBlock);
        if (target <= lastSettledBlock) return;

        uint256 newEmission = _cumulativeEmission(target - startBlock)
            - _cumulativeEmission(lastSettledBlock - startBlock);
        accMiniPerDot += Math.mulDiv(newEmission, ACC_PRECISION, totalRaisedDot);
        lastSettledBlock = target;
    }

    function _accrue(address account) internal {
        UserInfo storage user = users[account];
        uint256 accumulated = Math.mulDiv(user.contributedDot, accMiniPerDot, ACC_PRECISION);
        user.accruedMini += accumulated - user.rewardDebt;
        user.rewardDebt = accumulated;
    }

    function _currentAccMiniPerDot() internal view returns (uint256 currentAcc) {
        currentAcc = accMiniPerDot;
        if (!started()) return currentAcc;
        uint256 target = Math.min(block.number, emissionEndBlock);
        if (target <= lastSettledBlock) return currentAcc;

        uint256 newEmission = _cumulativeEmission(target - startBlock)
            - _cumulativeEmission(lastSettledBlock - startBlock);
        return currentAcc + Math.mulDiv(newEmission, ACC_PRECISION, totalRaisedDot);
    }

    function _cumulativeEmission(uint256 elapsedBlocks) internal view returns (uint256) {
        return Math.mulDiv(genesisAllocation, elapsedBlocks, totalEmissionBlocks);
    }

    function _finalize() internal {
        _updateGlobal();
        finalized = true;
        emit Finalized(
            totalRaisedDot, genesisAllocation, protectionEmissionMini(), curveStartPriceX18()
        );
    }
}
