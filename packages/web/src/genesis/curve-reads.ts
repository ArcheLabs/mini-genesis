import type { Address, PublicClient } from "viem";
import type { DeploymentManifest } from "../config/manifest";
import { phase2Address } from "../config/manifest";
import { curveAbi } from "./curve-abi.generated";

export type CurvePhaseName = "Waiting" | "Active" | "Ended";
export type GenesisCurveDynamic = {
  contract: Address;
  phase: number;
  phaseName: CurvePhaseName;
  allocation: bigint;
  startPrice: bigint;
  endPrice: bigint;
  startTime: bigint;
  endTime: bigint;
  totalSoldMini: bigint;
  totalRaisedDot: bigint;
  buyerCount: bigint;
  spotPrice: bigint;
  observedTimestamp: bigint;
};

const read = (client: PublicClient, address: Address, functionName: string, args?: readonly unknown[]) =>
  client.readContract({ address, abi: curveAbi, functionName, args } as any) as Promise<any>;

function curvePhaseName(value: number): CurvePhaseName {
  return value === 0 ? "Waiting" : value === 1 ? "Active" : "Ended";
}

export function getPhase2Contract(manifest: DeploymentManifest): Address | null {
  return phase2Address(manifest);
}

export async function readCurveDynamic(client: PublicClient, manifest: DeploymentManifest): Promise<GenesisCurveDynamic | null> {
  const contract = getPhase2Contract(manifest);
  if (!contract) return null;
  const [rawPhase, allocation, startPrice, endPrice, startTime, endTime, totalSoldMini, totalRaisedDot, buyerCount, spotPrice, block] = await Promise.all([
    read(client, contract, "phase"), read(client, contract, "allocation"), read(client, contract, "startPrice"), read(client, contract, "endPrice"),
    read(client, contract, "startTime"), read(client, contract, "endTime"), read(client, contract, "totalSoldMini"), read(client, contract, "totalRaisedDot"),
    read(client, contract, "buyerCount"), read(client, contract, "spotPrice"), client.getBlock({ blockTag: "latest" }),
  ]);
  const phase = Number(rawPhase);
  return { contract, phase, phaseName: curvePhaseName(phase), allocation, startPrice, endPrice, startTime, endTime, totalSoldMini, totalRaisedDot, buyerCount, spotPrice, observedTimestamp: block.timestamp };
}

export async function readCurveUser(client: PublicClient, manifest: DeploymentManifest, account: Address): Promise<bigint | null> {
  const contract = getPhase2Contract(manifest);
  return contract ? read(client, contract, "purchasedMini", [account]) : null;
}
