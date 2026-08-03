import { describe, expect, it, vi } from "vitest";
import { contribute } from "../src/genesis/contribution";
import { ACCOUNT, SOURCE_CONTRACT, contributedLog, manifest } from "./helpers";

function clients(logs: any[], finality = true) {
  let reads = 0;
  return { getBalance: vi.fn().mockResolvedValue(10n ** 20n), simulateContract: vi.fn().mockResolvedValue({}), waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", to: SOURCE_CONTRACT, blockNumber: 8n, logs }), request: vi.fn().mockImplementation(async () => { reads += 1; return finality ? { number: reads > 1 ? "0x10" : "0x10" } : null; }) } as any;
}
const wallet = { writeContract: vi.fn().mockResolvedValue(`0x${"ab".repeat(32)}`) } as any;
describe("contribution protocol", () => {
  it("validates receipt and event before finality", async () => { const updates: string[] = []; const c = clients([contributedLog(ACCOUNT, 10n ** 18n)]); await contribute(c, wallet, manifest(), ACCOUNT, "1", 0, 10n ** 18n, 1n, (u) => updates.push(u.state)); expect(updates).toEqual(["validating", "simulating", "awaiting_signature", "submitted", "included", "finalizing", "finalized"]); });
  it.each([
    ["missing", []], ["duplicate", [contributedLog(ACCOUNT, 10n ** 18n), contributedLog(ACCOUNT, 10n ** 18n)]], ["wrong contributor", [contributedLog(SOURCE_CONTRACT, 10n ** 18n)]], ["wrong amount", [contributedLog(ACCOUNT, 2n ** 18n)]],
  ])("rejects %s event", async (_name, logs) => { const updates: string[] = []; await expect(contribute(clients(logs), wallet, manifest(), ACCOUNT, "1", 0, 10n ** 18n, 1n, (u) => updates.push(`${u.state}:${u.error ?? ""}`))).rejects.toThrow("CONTRIBUTED_EVENT_MISMATCH"); expect(updates.some((v) => v.startsWith("included:"))).toBe(false); });
  it("rejects a reverted or wrong-target receipt", async () => { const c = clients([contributedLog(ACCOUNT, 10n ** 18n)]); c.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted", to: SOURCE_CONTRACT, blockNumber: 8n, logs: [] }); await expect(contribute(c, wallet, manifest(), ACCOUNT, "1", 0, 10n ** 18n, 1n)).rejects.toThrow("TRANSACTION_REVERTED"); });
  it("cancels with a stable operation code", async () => { const controller = new AbortController(); controller.abort(); await expect(contribute(clients([]), wallet, manifest(), ACCOUNT, "1", 0, 1n, 1n, undefined, controller.signal)).rejects.toThrow("OPERATION_CANCELLED"); });
});
