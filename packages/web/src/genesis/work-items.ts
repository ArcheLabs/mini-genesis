import type { GenesisLocalizedText, GenesisWorkItem } from "../config/manifest";

export type { GenesisLocalizedText, GenesisWorkItem };

const text = (en: string, zhCN: string): GenesisLocalizedText => ({ en, "zh-CN": zhCN });

/**
 * Repository fallback for manifests created before structured Genesis work
 * items were introduced. Runtime manifests remain authoritative when present.
 */
export const genesisPhase1WorkItems: readonly GenesisWorkItem[] = [
  {
    id: "minijam",
    name: "MiniJAM",
    status: "delivered",
    summary: text(
      "MiniJAM Stage-1 infrastructure and client generation delivered.",
      "MiniJAM Stage-1 基础设施与客户端生成已交付。",
    ),
  },
  {
    id: "jamscript",
    name: "JamScript",
    status: "delivered",
    summary: text(
      "Language, toolchain, runtime integration, deployment flow, and backend delivered.",
      "语言、工具链、运行时集成、部署流程与后端已形成并交付。",
    ),
  },
  {
    id: "jam-computer",
    name: "JAM Computer",
    status: "delivered",
    summary: text(
      "A user-facing JAM Computer application and product outcome delivered.",
      "面向用户的 JAM Computer 应用与产品成果已交付。",
    ),
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "delivered",
    summary: text(
      "Continuous-learning research system, experimental model architecture, and reproducible MiniCells research tooling delivered.",
      "持续学习研究系统、实验性模型架构与可复现的 MiniCells 研究工具已形成。",
    ),
  },
];
export const genesisPhase1ResearchHistory: readonly GenesisWorkItem[] = [
  {
    id: "zkjam",
    name: "ZkJAM",
    status: "discontinued",
    summary: text(
      "The initial ZK direction was investigated and discontinued after feasibility work.",
      "初始 ZK 方向经过可行性研究后停止，作为研究历史保留。",
    ),
  },
];

export const genesisPhase2WorkItems: readonly GenesisWorkItem[] = [
  {
    id: "jamscript",
    name: "JamScript",
    status: "active",
    summary: text(
      "Move JamScript from the released developer toolchain toward a usable application-development ecosystem on MiniJAM/JAM.",
      "推动 JamScript 从已发布的开发者工具链，走向 MiniJAM/JAM 上可用的应用开发生态。",
    ),
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "active",
    summary: text(
      "Advance MiniCells from reproducible continuous-learning research toward a network-usable AI service architecture.",
      "推动 MiniCells 从可复现的持续学习研究，走向可在网络中使用的 AI 服务架构。",
    ),
  },
  {
    id: "minijam",
    name: "MiniJAM",
    status: "active",
    summary: text(
      "Advance Stage-1 infrastructure toward a public-resource execution network for applications, shared state, computation, and future AI resources.",
      "推动 Stage-1 基础设施，建设面向应用、共享状态、计算与未来 AI 资源的公共资源执行网络。",
    ),
  },
  {
    id: "locus-ownership",
    name: "Locus & Ownership",
    status: "active",
    summary: text(
      "Develop wallet-agnostic ownership and asset interaction primitives across cryptographic accounts and external identities.",
      "开发跨密码学账户与外部身份的钱包无关所有权和资产交互原语。",
    ),
  },
  {
    id: "mini-utility",
    name: "MINI Utility",
    status: "planned",
    summary: text(
      "Make MINI the protocol settlement asset for application and public-resource usage across execution, storage, state, compute, and service resources.",
      "使 MINI 成为应用与公共资源使用的协议结算资产，覆盖执行、存储、状态、计算和服务资源。",
    ),
  },
  {
    id: "developer-ecosystem",
    name: "Developer Ecosystem",
    status: "active",
    summary: text(
      "Improve documentation, SDKs, tooling, infrastructure, and the path for third-party JamScript applications.",
      "改进文档、SDK、工具链、基础设施，以及第三方 JamScript 应用的开发路径。",
    ),
  },
];
