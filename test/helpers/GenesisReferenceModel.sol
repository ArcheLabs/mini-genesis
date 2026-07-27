// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev Test-only, direct per-block reference accounting. It deliberately does not
/// use the production reward-index algorithm.
contract GenesisReferenceModel {
    struct ModelUser {
        uint256 contributedDot;
        uint256 miniCredit;
    }

    uint256 public immutable genesisAllocation;
    uint256 public immutable contributionBlocks;
    uint256 public immutable protectionBlocks;
    uint256 public immutable totalEmissionBlocks;

    uint256 public startBlock;
    uint256 public contributionEndBlock;
    uint256 public emissionEndBlock;
    uint256 public lastModeledBlock;
    uint256 public totalDot;
    uint256 public totalCredit;

    address[] private actors;
    mapping(address account => ModelUser user) private modelUsers;

    constructor(
        uint256 genesisAllocation_,
        uint256 contributionBlocks_,
        uint256 protectionBlocks_,
        address[] memory actors_
    ) {
        genesisAllocation = genesisAllocation_;
        contributionBlocks = contributionBlocks_;
        protectionBlocks = protectionBlocks_;
        totalEmissionBlocks = contributionBlocks_ + protectionBlocks_;
        actors = actors_;
    }

    function contribute(address account, uint256 amount, uint256 atBlock) external {
        if (startBlock == 0) {
            startBlock = atBlock;
            contributionEndBlock = atBlock + contributionBlocks;
            emissionEndBlock = atBlock + totalEmissionBlocks;
            lastModeledBlock = atBlock;
        } else {
            settleTo(atBlock);
        }

        modelUsers[account].contributedDot += amount;
        totalDot += amount;
    }

    function settleTo(uint256 targetBlock) public {
        if (startBlock == 0 || targetBlock <= lastModeledBlock) return;
        uint256 target = targetBlock < emissionEndBlock ? targetBlock : emissionEndBlock;

        for (uint256 blockCursor = lastModeledBlock; blockCursor < target; ++blockCursor) {
            uint256 elapsed = blockCursor - startBlock;
            uint256 blockEmission = _cumulative(elapsed + 1) - _cumulative(elapsed);
            for (uint256 i; i < actors.length; ++i) {
                ModelUser storage modelUser = modelUsers[actors[i]];
                if (modelUser.contributedDot == 0) continue;
                uint256 reward = Math.mulDiv(blockEmission, modelUser.contributedDot, totalDot);
                modelUser.miniCredit += reward;
                totalCredit += reward;
            }
        }
        lastModeledBlock = target;
    }

    function user(address account) external view returns (ModelUser memory) {
        return modelUsers[account];
    }

    function credit(address account) external view returns (uint256) {
        return modelUsers[account].miniCredit;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _cumulative(uint256 elapsed) private view returns (uint256) {
        uint256 capped = elapsed < totalEmissionBlocks ? elapsed : totalEmissionBlocks;
        return Math.mulDiv(genesisAllocation, capped, totalEmissionBlocks);
    }
}
