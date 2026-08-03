import { encodeAbiParameters, encodeEventTopics, keccak256, toBytes, type Address, type Hex } from "viem";
import type { DeploymentManifest } from "../src/config/manifest";
import { genesisAbi } from "../src/genesis/abi";

export const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
export const IDENTITY = "0x2222222222222222222222222222222222222222" as Address;
export const SOURCE_CONTRACT = "0x3333333333333333333333333333333333333333" as Address;
export const DESTINATION = "0x4444444444444444444444444444444444444444" as Address;
export const SOURCE_HASH = `0x${"11".repeat(32)}` as Hex;
export const DESTINATION_HASH = `0x${"22".repeat(32)}` as Hex;
export const BLOCK_HASH = `0x${"33".repeat(32)}` as Hex;
export const ALIAS = `0x${"44".repeat(32)}` as Hex;
export const USERNAME = "alice.dot";

export function manifest(overrides: Partial<DeploymentManifest> = {}): DeploymentManifest {
  return {
    environment: "local", status: "deployed", evmNativeDecimals: 18,
    source: { chainId: "420420417", name: "test", currencySymbol: "PAS", evmNativeDecimals: 18, rpcHttpUrls: ["http://localhost"], explorerUrl: "", genesisHash: SOURCE_HASH, contract: SOURCE_CONTRACT, deploymentBlock: "1", runtimeCodeHash: BLOCK_HASH },
    destination: { chainId: "31337", genesisHash: DESTINATION_HASH, miniLucky: DESTINATION, trustGraph: ACCOUNT, personhoodPrecompile: DESTINATION, deploymentBlock: "1" },
    product: null, backend: { baseUrl: "http://localhost:8787" }, ...overrides,
  };
}

export function usernameHash(username = USERNAME): Hex { return keccak256(toBytes(username)); }
export function contributedLog(contributor: Address, amount: bigint, address = SOURCE_CONTRACT) {
  const topics = encodeEventTopics({ abi: genesisAbi, eventName: "Contributed", args: { contributor } });
  return { address, data: encodeAbiParameters([{ type: "uint256" }], [amount]), topics } as any;
}
