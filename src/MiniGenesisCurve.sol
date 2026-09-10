// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MiniGenesisCurve
/// @notice A fixed, quantity-based MINI distribution from the Early Operations Reserve.
/// @dev The contract records MINI credits. It does not mint, hold, or transfer MINI.
contract MiniGenesisCurve is ReentrancyGuard {
    enum Phase {
        Waiting,
        Active,
        Ended
    }

    uint256 public constant MINI_UNIT = 1e18;

    address public immutable treasury;
    uint256 public immutable allocation;
    uint256 public immutable startPrice;
    uint256 public immutable endPrice;
    uint64 public immutable startTime;
    uint64 public immutable endTime;

    uint256 public totalSoldMini;
    uint256 public totalRaisedDot;
    uint256 public buyerCount;

    mapping(address account => uint256 amount) public purchasedMini;

    event Purchased(
        address indexed buyer,
        uint256 miniAmount,
        uint256 dotCost,
        uint256 totalSoldMini,
        uint256 totalRaisedDot,
        uint256 spotPriceAfter
    );

    error ZeroAddress();
    error InvalidConfiguration();
    error NotActive();
    error ZeroAmount();
    error AllocationExceeded();
    error SlippageExceeded();
    error InsufficientPayment();
    error TreasuryTransferFailed();
    error RefundFailed();

    constructor(
        address treasury_,
        uint256 allocation_,
        uint256 startPrice_,
        uint256 endPrice_,
        uint64 startTime_,
        uint64 endTime_
    ) {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (
            allocation_ == 0 || startPrice_ == 0 || endPrice_ <= startPrice_ || startTime_ == 0
                || endTime_ <= startTime_
        ) {
            revert InvalidConfiguration();
        }
        uint256 priceDelta = endPrice_ - startPrice_;
        // Math.mulDiv handles the linear term with full intermediate precision.
        // These bounds protect only the explicit denominator and q^2 numerator
        // used by cumulativeCost at the maximum possible sold amount.
        if (
            allocation_ > type(uint256).max / (2 * MINI_UNIT)
                || priceDelta > type(uint256).max / allocation_ / allocation_
        ) {
            revert InvalidConfiguration();
        }

        treasury = treasury_;
        allocation = allocation_;
        startPrice = startPrice_;
        endPrice = endPrice_;
        startTime = startTime_;
        endTime = endTime_;
    }

    /// @notice Buy an exact MINI credit amount at the deterministic curve cost.
    /// @param miniAmount MINI base units, with 18 decimals.
    /// @param maxDotCost Maximum DOT base units the buyer permits for this purchase.
    function buyExactMini(uint256 miniAmount, uint256 maxDotCost) external payable nonReentrant {
        if (phase() != Phase.Active) revert NotActive();
        if (miniAmount == 0) revert ZeroAmount();

        if (miniAmount > allocation - totalSoldMini) revert AllocationExceeded();
        uint256 soldAfter = totalSoldMini + miniAmount;

        uint256 dotCost = quoteBuy(miniAmount);
        // Reject dust purchases that round to zero DOT. Otherwise an address could
        // create free MINI credit and inflate buyerCount without contributing value.
        if (dotCost == 0) revert InsufficientPayment();
        if (dotCost > maxDotCost) revert SlippageExceeded();
        if (msg.value < dotCost) revert InsufficientPayment();

        if (purchasedMini[msg.sender] == 0) ++buyerCount;
        purchasedMini[msg.sender] += miniAmount;
        totalSoldMini = soldAfter;
        // Using two values of the same cumulative function makes this update telescope.
        totalRaisedDot = cumulativeCost(soldAfter);

        // slither-disable-next-line low-level-calls
        (bool treasurySuccess,) = treasury.call{ value: dotCost }("");
        if (!treasurySuccess) revert TreasuryTransferFailed();

        uint256 refund = msg.value - dotCost;
        if (refund != 0) {
            // slither-disable-next-line low-level-calls
            (bool refundSuccess,) = msg.sender.call{ value: refund }("");
            if (!refundSuccess) revert RefundFailed();
        }

        emit Purchased(msg.sender, miniAmount, dotCost, totalSoldMini, totalRaisedDot, spotPrice());
    }

    function phase() public view returns (Phase) {
        // Timestamp comparisons are the intended immutable campaign clock. A
        // validator's small timestamp latitude cannot alter prices or allocation.
        // slither-disable-next-line timestamp
        if (block.timestamp < startTime) return Phase.Waiting;
        // slither-disable-next-line timestamp
        if (totalSoldMini == allocation || block.timestamp >= endTime) return Phase.Ended;
        return Phase.Active;
    }

    function soldOut() external view returns (bool) {
        return totalSoldMini == allocation;
    }

    function spotPrice() public view returns (uint256) {
        return priceAt(totalSoldMini);
    }

    function priceAt(uint256 sold) public view returns (uint256) {
        if (sold > allocation) revert AllocationExceeded();
        return startPrice + Math.mulDiv(endPrice - startPrice, sold, allocation);
    }

    /// @notice Cumulative DOT cost at a cumulative MINI amount.
    /// @dev All purchases must use differences of this function, never spotPrice * amount.
    function cumulativeCost(uint256 sold) public view returns (uint256) {
        if (sold > allocation) revert AllocationExceeded();

        uint256 linearTerm = Math.mulDiv(startPrice, sold, MINI_UNIT);
        uint256 quadraticNumerator = (endPrice - startPrice) * sold * sold;
        uint256 quadraticDenominator = 2 * allocation * MINI_UNIT;
        return linearTerm + quadraticNumerator / quadraticDenominator;
    }

    function quoteBuy(uint256 miniAmount) public view returns (uint256 dotCost) {
        if (miniAmount == 0) revert ZeroAmount();
        if (miniAmount > allocation - totalSoldMini) revert AllocationExceeded();
        uint256 soldAfter = totalSoldMini + miniAmount;
        return cumulativeCost(soldAfter) - cumulativeCost(totalSoldMini);
    }

    function remainingMini() external view returns (uint256) {
        return allocation - totalSoldMini;
    }

    receive() external payable {
        revert InsufficientPayment();
    }
}
