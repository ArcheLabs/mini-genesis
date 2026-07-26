// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

interface IMiniGenesisStream {
    enum Phase {
        Waiting,
        Contribution,
        Protection,
        Ended,
        Claims
    }

    struct UserInfo {
        uint256 contributedDot;
        uint256 rewardDebt;
        uint256 accruedMini;
        uint256 claimedMini;
    }

    event GenesisStarted(
        uint256 indexed startBlock,
        uint256 contributionEndBlock,
        uint256 emissionEndBlock,
        address indexed firstContributor,
        uint256 firstContribution
    );
    event Contributed(
        address indexed contributor, uint256 amount, uint256 accountTotal, uint256 totalRaised
    );
    event Finalized(
        uint256 totalRaised,
        uint256 genesisAllocation,
        uint256 protectionEmission,
        uint256 curveStartPriceX18
    );
    event ClaimsActivated(address indexed miniToken, uint256 fundedAmount);
    event Claimed(address indexed account, uint256 amount, uint256 accountClaimedTotal);

    error ZeroAddress();
    error InvalidConfiguration();
    error FirstContributionTooSmall();
    error ContributionTooSmall();
    error ContributionClosed();
    error NotStarted();
    error EmissionNotEnded();
    error AlreadyFinalized();
    error Unauthorized();
    error ClaimsAlreadyEnabled();
    error ClaimsNotEnabled();
    error InsufficientMiniFunding();
    error NothingToClaim();
    error TreasuryTransferFailed();

    function contribute() external payable;
    function finalize() external;
    function activateClaims(address miniToken_) external;
    function claim() external;
    function phase() external view returns (Phase);
    function started() external view returns (bool);
    function pendingMini(address account) external view returns (uint256);
    function cumulativeEmissionAt(uint256 blockNumber) external view returns (uint256);
    function emittedMini() external view returns (uint256);
    function remainingMini() external view returns (uint256);
    function protectionEmissionMini() external view returns (uint256);
    function streamAveragePriceX18() external view returns (uint256);
    function curveStartPriceX18() external view returns (uint256);
    function userInfo(address account) external view returns (UserInfo memory);
}
