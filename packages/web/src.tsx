import { useState } from "react";
import { createRoot } from "react-dom/client";
import { formatUnits, getAddress } from "viem";
import { deploymentManifests } from "./src/generated/deployment-manifests";
import "./style.css";

declare global { interface Window { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } } }

/** Genesis is a standalone EVM dApp. Native EVM values are always 18 decimals. */
export const EVM_NATIVE_DECIMALS = 18;
export const formatNative = (value: bigint) => formatUnits(value, EVM_NATIVE_DECIMALS);

function App() {
  const environment = (import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT ?? "local") as keyof typeof deploymentManifests;
  const manifest = deploymentManifests[environment] as { status: "template" | "deployed" } | undefined;
  const [account, setAccount] = useState("");
  const [notice, setNotice] = useState("Connect an EIP-1193 browser wallet. Genesis never uses the Product Host account API.");
  if (!manifest || manifest.status !== "deployed") return <main><h1>Deployment template</h1><p>{`Manifest ${String(environment)} is not runtime-ready.`}</p></main>;
  const connect = async () => {
    try {
      if (!window.ethereum) throw new Error("BROWSER_WALLET_UNAVAILABLE");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("BROWSER_WALLET_ACCOUNT_UNAVAILABLE");
      setAccount(getAddress(accounts[0]));
      setNotice("Browser wallet connected. EVM-native contribution amounts use 18 decimals.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "BROWSER_WALLET_CONNECT_FAILED"); }
  };
  return <main><header><span className="eyebrow">MINI GENESIS</span><h1>Contribute. Earn. Claim.</h1><p>Standalone Genesis dApp baseline. Contributions and claims use an EIP-1193 browser wallet.</p></header><section><h2>Browser wallet</h2><p>{account || "No connected H160 account"}</p><button type="button" onClick={connect}>Connect browser wallet</button></section><section><h2>Amount handling</h2><p>Native EVM values are normalized with 18 decimals (example: {formatNative(1_000_000_000_000_000_000n)}).</p><p>Contract contribution and Claim write flows are introduced in subsequent milestones; this baseline does not submit transactions.</p></section><p role="status">{notice}</p></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
