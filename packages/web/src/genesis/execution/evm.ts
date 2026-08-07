import type { Address, PublicClient, WalletClient } from "viem";
import type { DeploymentManifest } from "../../config/manifest";
import { genesisAbi } from "../abi";
import { safeMaxAmount } from "../amount";
import { contribute } from "../contribution";
import type { ContributionContext, GenesisExecutionAdapter } from "./types";

export function createEvmExecutionAdapter(client: PublicClient, wallet: WalletClient, manifest: DeploymentManifest, account: Address): GenesisExecutionAdapter {
  return {
    kind: "evm",
    async getBalance() { return { available: await client.getBalance({ address: account }), decimals: manifest.source.evmNativeDecimals }; },
    async contribute(input, context, onUpdate = () => {}, signal) {
      const result = await contribute(client, wallet, manifest, account, input, context.phase, context.firstMinimum, context.subsequentExclusive, onUpdate as any, signal);
      return { execution: "evm", blockNumber: result.blockNumber, amount: result.amount, contributorH160: account, evmTxHash: result.hash };
    },
    async safeMax() {
      const phase = await client.readContract({ address: manifest.source.contract, abi: genesisAbi, functionName: "phase" } as any).catch(() => 3);
      const config = manifest.source.contractConfig;
      if (!config?.firstContributionMinimum || !config.subsequentContributionMinimumExclusive) return null;
      return safeMaxAmount(client, { account, contract: manifest.source.contract, phase: Number(phase), firstContributionMinimum: BigInt(config.firstContributionMinimum), subsequentContributionMinimumExclusive: BigInt(config.subsequentContributionMinimumExclusive) });
    },
  };
}
