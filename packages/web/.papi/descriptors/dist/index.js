import { _Enum } from 'polkadot-api';

const table = new Uint8Array(128);
for (let i = 0; i < 64; i++) table[i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i * 4 - 205] = i;
const toBinary = (base64) => {
  const n = base64.length, bytes = new Uint8Array((n - Number(base64[n - 1] === "=") - Number(base64[n - 2] === "=")) * 3 / 4 | 0);
  for (let i2 = 0, j = 0; i2 < n; ) {
    const c0 = table[base64.charCodeAt(i2++)], c1 = table[base64.charCodeAt(i2++)];
    const c2 = table[base64.charCodeAt(i2++)], c3 = table[base64.charCodeAt(i2++)];
    bytes[j++] = c0 << 2 | c1 >> 4;
    bytes[j++] = c1 << 4 | c2 >> 2;
    bytes[j++] = c2 << 6 | c3;
  }
  return bytes;
};

const descriptorValues$1 = import('./descriptors-C3VNPI73.js').then((module) => module["Polkadot_asset_hub"]);
const metadataTypes$1 = import('./metadataTypes-C-ivzeNX.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset$1 = {};
const extensions$1 = {};
const getMetadata$2 = () => import('./polkadot_asset_hub_metadata-zM1M2eiK.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis$1 = "0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f";
const _allDescriptors$1 = { descriptors: descriptorValues$1, metadataTypes: metadataTypes$1, asset: asset$1, extensions: extensions$1, getMetadata: getMetadata$2, genesis: genesis$1 };

const descriptorValues = import('./descriptors-C3VNPI73.js').then((module) => module["Paseo_asset_hub"]);
const metadataTypes = import('./metadataTypes-C-ivzeNX.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const asset = {};
const extensions = {};
const getMetadata$1 = () => import('./paseo_asset_hub_metadata-Ds1HrdOV.js').then(
  (module) => toBinary("default" in module ? module.default : module)
);
const genesis = "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2";
const _allDescriptors = { descriptors: descriptorValues, metadataTypes, asset, extensions, getMetadata: getMetadata$1, genesis };

const DigestItem = _Enum;
const Phase = _Enum;
const DispatchClass = _Enum;
const TokenError = _Enum;
const ArithmeticError = _Enum;
const TransactionalError = _Enum;
const PreimageEvent = _Enum;
const BalanceStatus = _Enum;
const PreimagePalletHoldReason = _Enum;
const TransactionPaymentEvent = _Enum;
const XcmV5Junctions = _Enum;
const XcmV5Junction = _Enum;
const XcmV5NetworkId = _Enum;
const XcmV3JunctionBodyId = _Enum;
const XcmV2JunctionBodyPart = _Enum;
const CommonClaimsEvent = _Enum;
const XcmV5Instruction = _Enum;
const XcmV3MultiassetFungibility = _Enum;
const XcmV3MultiassetAssetInstance = _Enum;
const XcmV3MaybeErrorCode = _Enum;
const XcmV2OriginKind = _Enum;
const XcmV5AssetFilter = _Enum;
const XcmV5WildAsset = _Enum;
const XcmV2MultiassetWildFungibility = _Enum;
const XcmV3WeightLimit = _Enum;
const XcmVersionedAssets = _Enum;
const XcmV3MultiassetAssetId = _Enum;
const XcmV3Junctions = _Enum;
const XcmV3Junction = _Enum;
const XcmV3JunctionNetworkId = _Enum;
const XcmVersionedLocation = _Enum;
const ConvictionVotingVoteAccountVote = _Enum;
const PreimagesBounded = _Enum;
const ChildBountiesEvent = _Enum;
const NominationPoolsPoolState = _Enum;
const NominationPoolsCommissionClaimPermission = _Enum;
const NominationPoolsClaimPermission = _Enum;
const BagsListEvent = _Enum;
const StakingRewardDestination = _Enum;
const StakingForcing = _Enum;
const UpgradeGoAhead = _Enum;
const UpgradeRestriction = _Enum;
const PreimageOldRequestStatus = _Enum;
const PreimageRequestStatus = _Enum;
const GovernanceOrigin = _Enum;
const BalancesTypesReasons = _Enum;
const NominationPoolsPalletFreezeReason = _Enum;
const TransactionPaymentReleases = _Enum;
const Version = _Enum;
const ClaimsStatementKind = _Enum;
const XcmV3Response = _Enum;
const XcmV3TraitsError = _Enum;
const XcmV4Response = _Enum;
const XcmPalletVersionMigrationStage = _Enum;
const XcmVersionedAssetId = _Enum;
const TreasuryPaymentState = _Enum;
const ConvictionVotingVoteVoting = _Enum;
const VotingConviction = _Enum;
const TraitsScheduleDispatchTime = _Enum;
const ChildBountyStatus = _Enum;
const ReferendaTypesCurve = _Enum;
const MultiAddress = _Enum;
const BalancesAdjustmentDirection = _Enum;
const XcmVersionedXcm = _Enum;
const XcmV3Instruction = _Enum;
const XcmV3MultiassetMultiAssetFilter = _Enum;
const XcmV3MultiassetWildMultiAsset = _Enum;
const XcmV4Instruction = _Enum;
const XcmV4AssetAssetFilter = _Enum;
const XcmV4AssetWildAsset = _Enum;
const NominationPoolsBondExtra = _Enum;
const StakingPalletConfigOpBig = _Enum;
const StakingPalletConfigOp = _Enum;
const NominationPoolsConfigOp = _Enum;
const TransactionValidityUnknownTransaction = _Enum;
const TransactionValidityTransactionSource = _Enum;
const XcmVersionedAsset = _Enum;

const metadatas = {
  ["0x80019b852cb8dbd47f5c13dc9a56eb5a30b9d68440d681e9959ecd25f3751de9"]: _allDescriptors$1,
  ["0x73bb1c8197a2d7786be576b499faa2703c52b88580f1c7d03f141cf6642bcd5b"]: _allDescriptors
};
const getMetadata = async (codeHash) => {
  try {
    return await metadatas[codeHash].getMetadata();
  } catch {
  }
  return null;
};

export { ArithmeticError, BagsListEvent, BalanceStatus, BalancesAdjustmentDirection, BalancesTypesReasons, ChildBountiesEvent, ChildBountyStatus, ClaimsStatementKind, CommonClaimsEvent, ConvictionVotingVoteAccountVote, ConvictionVotingVoteVoting, DigestItem, DispatchClass, GovernanceOrigin, MultiAddress, NominationPoolsBondExtra, NominationPoolsClaimPermission, NominationPoolsCommissionClaimPermission, NominationPoolsConfigOp, NominationPoolsPalletFreezeReason, NominationPoolsPoolState, Phase, PreimageEvent, PreimageOldRequestStatus, PreimagePalletHoldReason, PreimageRequestStatus, PreimagesBounded, ReferendaTypesCurve, StakingForcing, StakingPalletConfigOp, StakingPalletConfigOpBig, StakingRewardDestination, TokenError, TraitsScheduleDispatchTime, TransactionPaymentEvent, TransactionPaymentReleases, TransactionValidityTransactionSource, TransactionValidityUnknownTransaction, TransactionalError, TreasuryPaymentState, UpgradeGoAhead, UpgradeRestriction, Version, VotingConviction, XcmPalletVersionMigrationStage, XcmV2JunctionBodyPart, XcmV2MultiassetWildFungibility, XcmV2OriginKind, XcmV3Instruction, XcmV3Junction, XcmV3JunctionBodyId, XcmV3JunctionNetworkId, XcmV3Junctions, XcmV3MaybeErrorCode, XcmV3MultiassetAssetId, XcmV3MultiassetAssetInstance, XcmV3MultiassetFungibility, XcmV3MultiassetMultiAssetFilter, XcmV3MultiassetWildMultiAsset, XcmV3Response, XcmV3TraitsError, XcmV3WeightLimit, XcmV4AssetAssetFilter, XcmV4AssetWildAsset, XcmV4Instruction, XcmV4Response, XcmV5AssetFilter, XcmV5Instruction, XcmV5Junction, XcmV5Junctions, XcmV5NetworkId, XcmV5WildAsset, XcmVersionedAsset, XcmVersionedAssetId, XcmVersionedAssets, XcmVersionedLocation, XcmVersionedXcm, getMetadata, _allDescriptors as paseo_asset_hub, _allDescriptors$1 as polkadot_asset_hub };
