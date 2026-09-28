export function formatTokenAmount(value: bigint, decimals = 18, fractionDigits = 2): string {
  const scale = 10n ** BigInt(fractionDigits);
  const unit = 10n ** BigInt(decimals);
  const rounded = (value * scale + unit / 2n) / unit;
  const whole = (rounded / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (!fractionDigits) return whole;
  return `${whole}.${(rounded % scale).toString().padStart(fractionDigits, "0")}`;
}
