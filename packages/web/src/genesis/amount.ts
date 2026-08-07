import { formatUnits, type Address, type PublicClient } from "viem";
import { genesisAbi } from "./abi";

export const DOT_NATIVE_DECIMALS = 10;
export const EVM_NATIVE_DECIMALS = 18;
export const NATIVE_TO_EVM_RATIO = 100_000_000n;

const STRICT_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,10})?$/;
export type AmountErrorCode = "INVALID_AMOUNT" | "FIRST_CONTRIBUTION_TOO_SMALL" | "CONTRIBUTION_TOO_SMALL" | "CONTRIBUTION_CLOSED";
export class AmountError extends Error { constructor(public readonly code: AmountErrorCode) { super(code); } }

export type ParsedDotAmount = { planck: bigint; evmWei: bigint };

export function parseDotAmount(input: string): ParsedDotAmount {
  if (!STRICT_AMOUNT.test(input) || input === "0" || /^0\.0+$/.test(input)) throw new AmountError("INVALID_AMOUNT");
  const [whole, fraction = ""] = input.split(".");
  const planck = BigInt(whole) * 10n ** BigInt(DOT_NATIVE_DECIMALS) + BigInt(fraction.padEnd(DOT_NATIVE_DECIMALS, "0") || "0");
  if (planck <= 0n) throw new AmountError("INVALID_AMOUNT");
  return { planck, evmWei: planck * NATIVE_TO_EVM_RATIO };
}

/** @deprecated Use parseDotAmount(input).evmWei or .planck explicitly. */
export function parseNativeAmount(input: string): bigint { return parseDotAmount(input).evmWei; }

export function validateContributionAmount(input: string, phase: number, firstMinimum: bigint, subsequentExclusive: bigint): ParsedDotAmount {
  const amount = parseDotAmount(input);
  if (phase >= 2) throw new AmountError("CONTRIBUTION_CLOSED");
  if (phase === 0 && amount.evmWei < firstMinimum) throw new AmountError("FIRST_CONTRIBUTION_TOO_SMALL");
  if (phase === 1 && amount.evmWei <= subsequentExclusive) throw new AmountError("CONTRIBUTION_TOO_SMALL");
  return amount;
}
export function formatNative(value: bigint): string { return formatUnits(value, EVM_NATIVE_DECIMALS); }
export function formatPlanck(value: bigint): string { return formatUnits(value, DOT_NATIVE_DECIMALS); }
export type SafeMaxAmountInput = {
  account: Address;
  contract: Address;
  phase: number;
  firstContributionMinimum: bigint;
  subsequentContributionMinimumExclusive: bigint;
};

function contributionProbeValue(phase: number, firstMinimum: bigint, subsequentExclusive: bigint): bigint {
  if (phase === 0) return firstMinimum;
  if (phase === 1) return subsequentExclusive + 1n;
  return 0n;
}

export async function safeMaxAmount(client: PublicClient, input: SafeMaxAmountInput): Promise<bigint | null> {
  if (input.phase >= 2) return 0n;
  try {
    const balance = await client.getBalance({ address: input.account });
    const probeValue = contributionProbeValue(input.phase, input.firstContributionMinimum, input.subsequentContributionMinimumExclusive);
    if (balance <= probeValue) return 0n;
    const gas = await client.estimateContractGas({
      address: input.contract,
      abi: genesisAbi,
      functionName: "contribute",
      account: input.account,
      value: probeValue,
    } as any);
    const gasPrice = await client.getGasPrice();
    const fee = gas * gasPrice;
    const bufferedFee = fee + fee / 5n;
    const max = balance > bufferedFee ? balance - bufferedFee : 0n;
    const minimum = input.phase === 0 ? input.firstContributionMinimum : input.subsequentContributionMinimumExclusive + 1n;
    return max >= minimum ? max : 0n;
  } catch {
    return null;
  }
}
