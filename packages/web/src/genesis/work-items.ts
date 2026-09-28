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
      "Stage-1 infrastructure",
      "Stage-1 基础设施",
    ),
  },
  {
    id: "jamscript",
    name: "JamScript",
    status: "delivered",
    summary: text(
      "Language and deployment tooling",
      "语言与部署工具链",
    ),
  },
  {
    id: "jam-computer",
    name: "JAM Computer",
    status: "delivered",
    summary: text(
      "User-facing JAM application",
      "面向用户的 JAM 应用",
    ),
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "delivered",
    summary: text(
      "Research system and tooling",
      "研究系统与工具",
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
      "Provide high-level development, build, and deployment tools for JAM applications, so developers can work without handling low-level execution and toolchain complexity directly.",
      "为 JAM 应用提供高层开发、构建和部署工具，让开发者无需直接处理底层执行模型和工具链复杂度。",
    ),
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "active",
    summary: text(
      "Explore a continuously updated, composable AI service architecture that can make model capabilities long-running network resources.",
      "探索可持续更新和组合的 AI 服务架构，使模型能力可以作为网络中的长期运行资源。",
    ),
  },
  {
    id: "minijam",
    name: "MiniJAM",
    status: "active",
    summary: text(
      "Build an execution network for shared public state, computation, and AI resources, while testing the boundaries of the JAM service model in real applications.",
      "建设面向公共状态、计算和 AI 等共享资源的执行网络，并继续验证 JAM 服务模型在真实应用中的边界。",
    ),
  },
  {
    id: "locus-ownership",
    name: "Locus & Ownership",
    status: "active",
    summary: text(
      "Create wallet-independent ownership and asset experiences so different identities and cryptographic systems can use a shared asset model.",
      "建立钱包无关的所有权与资产使用体验，使不同身份和密码体系能够使用统一的资产模型。",
    ),
  },
  {
    id: "mini-utility",
    name: "MINI Utility",
    status: "planned",
    summary: text(
      "Establish practical uses for MINI in service payments, resource access, and network settlement.",
      "逐步建立 MINI 在服务支付、资源使用与网络结算中的实际用途。",
    ),
  },
  {
    id: "developer-ecosystem",
    name: "Developer Ecosystem",
    status: "active",
    summary: text(
      "Improve documentation, examples, SDKs, deployment flows, and developer tools to lower the cost of building third-party applications.",
      "完善文档、示例、SDK、部署流程和开发工具，降低第三方开发者进入生态的成本。",
    ),
  },
];
