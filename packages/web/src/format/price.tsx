import { formatUnits } from "viem";
import type { ReactElement } from "react";

function roundedDecimal(value: string, decimals: number): string {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length <= decimals) return `${whole}${fraction ? `.${fraction.replace(/0+$/, "")}` : ""}`;
  const kept = fraction.slice(0, decimals);
  const next = fraction[decimals];
  let scaled = BigInt(`${whole}${kept}` || "0");
  if (next >= "5") scaled += 1n;
  const scale = 10n ** BigInt(decimals);
  const roundedWhole = scaled / scale;
  const roundedFraction = (scaled % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${roundedWhole}${roundedFraction ? `.${roundedFraction}` : ""}`;
}

export function Price({ value }: { value: bigint | null }): ReactElement {
  if (value === null) return <span className="price-number">—</span>;
  const fullDecimal = formatUnits(value, 18);
  const [whole, fraction = ""] = fullDecimal.split(".");
  if (value === 0n) return <span className="price-number" aria-label={fullDecimal} title={fullDecimal}>0</span>;
  const leadingZeros = whole === "0" ? (fraction.match(/^0*/)?.[0].length ?? 0) : 0;
  if (whole === "0" && leadingZeros >= 5) {
    const compressedZeros = leadingZeros - 3;
    const significant = fraction.slice(leadingZeros).replace(/0+$/, "");
    const roundedSignificant = significant.length > 4 ? roundedDecimal(`0.${significant}`, 4).split(".")[1]?.replace(/^0+/, "") || "0" : significant || "0";
    return <span className="price-number" aria-label={fullDecimal} title={fullDecimal}><span>0.00</span><sub className="price-zero-count">{compressedZeros}</sub><span>{`0${roundedSignificant}`}</span></span>;
  }
  const decimals = whole === "0" ? 8 : 6;
  return <span className="price-number" aria-label={fullDecimal} title={fullDecimal}>{roundedDecimal(fullDecimal, decimals)}</span>;
}
