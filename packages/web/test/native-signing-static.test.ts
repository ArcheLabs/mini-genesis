import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Native transaction architecture", () => {
  it("routes map_account and Revive calls through PAPI v3 TxCreator", () => {
    const native = readFileSync("src/wallet/substrate/native-transaction.ts", "utf8");
    const mapping = readFileSync("src/wallet/substrate/mapping.ts", "utf8");
    const purchase = readFileSync("src/genesis/curve-contribution-native.ts", "utf8");
    expect(native).toContain("createSubmitAndWatch");
    expect(mapping).toContain("api.tx.Revive.map_account()");
    expect(purchase).toContain("api.tx.Revive.call");
    expect(mapping).toContain("submitNativeTransaction");
    expect(purchase).toContain("submitNativeTransaction");
  });

  it("has no application-owned PJS transaction or raw-signature fallback", () => {
    const files = [
      "src/wallet/substrate/native-transaction.ts",
      "src/wallet/substrate/mapping.ts",
      "src/genesis/curve-contribution-native.ts",
      "src/genesis/execution/substrate.ts",
      "src/wallet/use-genesis-wallet.ts",
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(files).not.toMatch(/\.signAndSend\s*\(|\.signAndSubmit\s*\(|signPayload\s*\(|signRaw\s*\(/);
    expect(files).toContain("txCreator");
  });
});
