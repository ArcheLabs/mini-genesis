import { describe, expect, it } from "vitest";
import { accountId32ToSs58 } from "../src/wallet/substrate/account";

describe("Lucky Credit identity confirmation", () => {
  it("converts the backend owner AccountId32 to SS58 without deriving a Product address", () => {
    expect(accountId32ToSs58(`0x${"11".repeat(32)}`, 0)).toBe("1PNtGSJ2VC7gGhEPqTbtj9mBEUcwM3SDL71WSqtRzSVxDkG");
  });
});
