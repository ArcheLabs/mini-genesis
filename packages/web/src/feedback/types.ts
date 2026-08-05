import type { Hash } from "viem";
import type { FeedbackCode } from "./codes";

export type FeedbackKind = "error" | "warning" | "success" | "info";
export type FeedbackSurface = "field" | "notification" | "banner" | "silent";
export type FeedbackAction = "switch-network" | "connect-wallet" | "retry-global-data" | "retry-user-data" | "view-transaction";
export type FeedbackParams = { minimum?: string; available?: string; required?: string; networkName?: string; transactionHash?: Hash; explorerUrl?: string };
export type NormalizedFeedback = {
  code: FeedbackCode;
  kind: FeedbackKind;
  surface: FeedbackSurface;
  title: string;
  message: string;
  action?: FeedbackAction;
  actionLabel?: string;
  transactionHash?: Hash;
  explorerUrl?: string;
  persistent: boolean;
  autoDismissMs?: number;
  dedupeKey: string;
};
export type FeedbackContext = {
  operation: "connect-wallet" | "switch-network" | "restore-wallet" | "load-global" | "load-user" | "load-history" | "calculate-max" | "submit-contribution";
  locale: "zh-CN" | "en";
  params?: FeedbackParams;
};
