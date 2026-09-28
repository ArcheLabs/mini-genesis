import { describe, expect, it } from "vitest";
import { syncWrongChainFeedback } from "../src/wallet/wrong-chain-feedback";

describe("wrong chain feedback recovery", () => {
  it("clears the persistent banner after the provider reaches the expected chain", () => {
    const banners = new Set<string>();
    const sync = (correctChain: boolean) => syncWrongChainFeedback({
      correctChain,
      present: () => { banners.add("WRONG_CHAIN"); },
      clear: () => { banners.delete("WRONG_CHAIN"); },
    });

    sync(false);
    expect(banners.has("WRONG_CHAIN")).toBe(true);
    sync(true);
    expect(banners.has("WRONG_CHAIN")).toBe(false);
  });
});
