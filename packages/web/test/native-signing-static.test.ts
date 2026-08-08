import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Native signing architecture", () => {
  it("contains no raw signing call in the Native Genesis path", () => {
    const execution = readFileSync("src/genesis/execution/substrate.ts", "utf8");
    const submission = readFileSync("src/wallet/substrate/injected-transaction.ts", "utf8");
    expect(`${execution}\n${submission}`).not.toContain("signRaw");
    expect(submission).toContain("signAndSend(address, { signer: injector.signer }");
  });
});
