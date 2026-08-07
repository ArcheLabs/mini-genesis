import { default as polkadot_asset_hub, type Polkadot_asset_hubWhitelistEntry } from "./polkadot_asset_hub";
export { polkadot_asset_hub };
export type * from "./polkadot_asset_hub";
import { default as paseo_asset_hub, type Paseo_asset_hubWhitelistEntry } from "./paseo_asset_hub";
export { paseo_asset_hub };
export type * from "./paseo_asset_hub";
export { DigestItem, Phase, DispatchClass, TokenError, ArithmeticError, TransactionalError, PreimageEvent, BalanceStatus, PreimagePalletHoldReason, TransactionPaymentEvent, XcmV5Junctions, XcmV5Junction, XcmV5NetworkId, XcmV3JunctionBodyId, XcmV2JunctionBodyPart, CommonClaimsEvent, XcmV5Instruction, XcmV3MultiassetFungibility, XcmV3MultiassetAssetInstance, XcmV3MaybeErrorCode, XcmV2OriginKind, XcmV5AssetFilter, XcmV5WildAsset, XcmV2MultiassetWildFungibility, XcmV3WeightLimit, XcmVersionedAssets, XcmV3MultiassetAssetId, XcmV3Junctions, XcmV3Junction, XcmV3JunctionNetworkId, XcmVersionedLocation, ConvictionVotingVoteAccountVote, PreimagesBounded, ChildBountiesEvent, NominationPoolsPoolState, NominationPoolsCommissionClaimPermission, NominationPoolsClaimPermission, BagsListEvent, StakingRewardDestination, StakingForcing, UpgradeGoAhead, UpgradeRestriction, PreimageOldRequestStatus, PreimageRequestStatus, GovernanceOrigin, BalancesTypesReasons, NominationPoolsPalletFreezeReason, TransactionPaymentReleases, Version, ClaimsStatementKind, XcmV3Response, XcmV3TraitsError, XcmV4Response, XcmPalletVersionMigrationStage, XcmVersionedAssetId, TreasuryPaymentState, ConvictionVotingVoteVoting, VotingConviction, TraitsScheduleDispatchTime, ChildBountyStatus, ReferendaTypesCurve, MultiAddress, BalancesAdjustmentDirection, XcmVersionedXcm, XcmV3Instruction, XcmV3MultiassetMultiAssetFilter, XcmV3MultiassetWildMultiAsset, XcmV4Instruction, XcmV4AssetAssetFilter, XcmV4AssetWildAsset, NominationPoolsBondExtra, StakingPalletConfigOpBig, StakingPalletConfigOp, NominationPoolsConfigOp, TransactionValidityUnknownTransaction, TransactionValidityTransactionSource, XcmVersionedAsset } from './common-types';
export declare const getMetadata: (codeHash: string) => Promise<Uint8Array | null>;
export type WhitelistEntry = Polkadot_asset_hubWhitelistEntry | Paseo_asset_hubWhitelistEntry;
export type WhitelistEntriesByChain = Partial<{
    "*": WhitelistEntry[];
    polkadot_asset_hub: WhitelistEntry[];
    paseo_asset_hub: WhitelistEntry[];
}>;
