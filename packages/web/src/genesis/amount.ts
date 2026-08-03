import { formatEther, parseEther } from "viem";

const STRICT_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
export class AmountError extends Error { constructor(public readonly code: "INVALID_AMOUNT" | "FIRST_CONTRIBUTION_TOO_SMALL" | "CONTRIBUTION_TOO_SMALL" | "CONTRIBUTION_CLOSED") { super(code); } }
export function parseNativeAmount(input: string): bigint {
  if (!STRICT_AMOUNT.test(input) || input === "0" || /^0\.0+$/.test(input)) throw new AmountError("INVALID_AMOUNT");
  try { return parseEther(input); } catch { throw new AmountError("INVALID_AMOUNT"); }
}
export function validateContributionAmount(input: string, phase: number, firstMinimum: bigint, subsequentExclusive: bigint): bigint {
  const amount = parseNativeAmount(input);
  if (phase >= 2) throw new AmountError("CONTRIBUTION_CLOSED");
  if (phase === 0 && amount < firstMinimum) throw new AmountError("FIRST_CONTRIBUTION_TOO_SMALL");
  if (phase === 1 && amount <= subsequentExclusive) throw new AmountError("CONTRIBUTION_TOO_SMALL");
  return amount;
}
export function formatNative(value: bigint): string { return formatEther(value); }
export async function safeMaxAmount(client: { estimateGas(args: any): Promise<bigint>; getBalance(args: any): Promise<bigint> }, args: { account: `0x${string}`; to: `0x${string}` }): Promise<bigint | null> {
  try {
    const balance = await client.getBalance({ address: args.account });
    const gas = await client.estimateGas({ account: args.account, to: args.to, value: 1n });
    const gasPrice = await (client as any).getGasPrice();
    const fee = gas * gasPrice;
    const buffer = fee + fee / 10n;
    return balance > buffer ? balance - buffer : 0n;
  } catch { return null; }
}
