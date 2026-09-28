import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { getPhase2Contract, readCurveDynamic, type GenesisCurveDynamic } from "./curve-reads";
import type { Eip1193Provider } from "../wallet/eip1193";
import type { WalletSession } from "../wallet/types";
import { GenesisPhase1 } from "./GenesisPhase1";
import { GenesisPhase2 } from "./GenesisPhase2";
import { GenesisPhase3 } from "./GenesisPhase3";
import type { GenesisStageId } from "../navigation/routing";

type Language = "zh-CN" | "en";
type Props = {
  language: Language;
  stage: GenesisStageId;
  refreshKey: number;
  onPhase2StatusChange: (status: string) => void;
  manifest: DeploymentManifest | null;
  publicClient: PublicClient | null;
  session: WalletSession;
  provider: Eip1193Provider | null;
  walletReady: boolean;
  correctChain: boolean;
  demoMode?: boolean;
  onConnect: () => void;
  onRefresh: () => void;
};

function phase2Snapshot(manifest: DeploymentManifest | null): GenesisCurveDynamic | null {
  const phase2 = manifest?.genesis?.phases.phase2;
  const snapshot = phase2?.snapshot;
  if (!snapshot) return null;
  return {
    contract: snapshot.contract,
    phase: 2,
    phaseName: "Ended",
    allocation: BigInt(snapshot.allocationMini),
    startPrice: BigInt(snapshot.startPriceX18),
    endPrice: BigInt(phase2?.endPriceX18 ?? snapshot.terminalPriceX18),
    startTime: BigInt(snapshot.startTime),
    endTime: BigInt(snapshot.endTime),
    totalSoldMini: BigInt(snapshot.soldMini),
    totalRaisedDot: BigInt(snapshot.raisedDot),
    buyerCount: BigInt(snapshot.buyerCount),
    spotPrice: BigInt(snapshot.terminalPriceX18),
    observedTimestamp: BigInt(snapshot.endTime),
  };
}

export function phase2Status(dynamic: GenesisCurveDynamic | null, manifest: DeploymentManifest | null, demoMode: boolean): string {
  if (dynamic?.phaseName === "Waiting") return "WAITING";
  if (dynamic?.phaseName === "Active") return "LIVE";
  if (dynamic?.phaseName === "Ended") return dynamic.totalSoldMini === dynamic.allocation ? "COMPLETED · SOLD OUT" : "COMPLETED";
  const status = manifest?.genesis?.phases.phase2?.status;
  if (status === "ended") return "COMPLETED";
  if (status === "active" || demoMode) return "LIVE";
  return "WAITING";
}

export function GenesisStages({ language, stage, refreshKey, onPhase2StatusChange, manifest, publicClient, session, provider, walletReady, correctChain, demoMode = false, onConnect, onRefresh }: Props) {
  const [dynamic, setDynamic] = useState<GenesisCurveDynamic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const snapshot = useMemo(() => phase2Snapshot(manifest), [manifest]);
  const phase2Contract = manifest ? getPhase2Contract(manifest) : null;

  const refresh = useCallback(async () => {
    if (!manifest || !phase2Contract || !publicClient) {
      setDynamic(snapshot);
      return;
    }
    try {
      setDynamic(await readCurveDynamic(publicClient, manifest) ?? snapshot);
      setError(null);
    } catch {
      setDynamic(snapshot);
      setError(language === "zh-CN" ? "Genesis II 链上数据暂不可用。" : "Genesis II chain data is temporarily unavailable.");
    }
  }, [language, manifest, phase2Contract, publicClient, refreshKey, snapshot]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const status = phase2Status(dynamic, manifest, demoMode);
  useEffect(() => onPhase2StatusChange(status), [onPhase2StatusChange, status]);

  return <main className="genesis-stages">
    {error && <p className="genesis-data-note" role="status">{error}</p>}
    {stage === "phase1" && <GenesisPhase1 language={language} workItems={manifest?.genesis?.phases.phase1.workItems ?? manifest?.genesis?.phases.phase1.achievements} />}
    {stage === "phase2" && <GenesisPhase2 language={language} manifest={manifest} publicClient={publicClient} session={session} provider={provider} walletReady={walletReady} correctChain={correctChain} dynamic={dynamic} demoMode={demoMode} onConnect={onConnect} onRefresh={() => { onRefresh(); void refresh(); }} />}
    {stage === "phase3" && <GenesisPhase3 language={language} />}
  </main>;
}
