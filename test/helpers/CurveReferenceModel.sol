// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/// @notice Small independent arithmetic reference for the Phase II tests.
/// @dev This intentionally does not import MiniGenesisCurve.
library CurveReferenceModel {
    uint256 internal constant UNIT = 1e18;

    function priceAt(uint256 startPrice, uint256 endPrice, uint256 allocation, uint256 sold)
        internal
        pure
        returns (uint256)
    {
        return startPrice + (endPrice - startPrice) * sold / allocation;
    }

    function cumulativeCost(uint256 startPrice, uint256 endPrice, uint256 allocation, uint256 sold)
        internal
        pure
        returns (uint256)
    {
        uint256 linear = startPrice * sold / UNIT;
        uint256 quadratic = (endPrice - startPrice) * sold * sold / (2 * allocation * UNIT);
        return linear + quadratic;
    }
}
