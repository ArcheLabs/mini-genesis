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
    tasks: [
      { id: "service-runtime", name: text("Service runtime", "服务运行时"), status: "delivered" },
      { id: "client-generation", name: text("Client generation", "客户端生成"), status: "delivered" },
    ],
  },
  {
    id: "jamscript",
    name: "JamScript",
    status: "delivered",
    summary: text(
      "Language and deployment tooling",
      "语言与部署工具链",
    ),
    tasks: [
      { id: "language-runtime", name: text("Language and runtime", "语言与运行时"), status: "delivered" },
      { id: "deployment-flow", name: text("Build and deployment flow", "构建与部署流程"), status: "delivered" },
    ],
  },
  {
    id: "jam-computer",
    name: "JAM Computer",
    status: "delivered",
    summary: text(
      "User-facing JAM application",
      "面向用户的 JAM 应用",
    ),
    tasks: [
      { id: "application", name: text("JAM Computer application", "JAM Computer 应用"), status: "delivered" },
      { id: "public-demo", name: text("Public product experience", "公开产品体验"), status: "delivered" },
    ],
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "delivered",
    summary: text(
      "Research system and tooling",
      "研究系统与工具",
    ),
    tasks: [
      { id: "research-system", name: text("Research system", "研究系统"), status: "delivered" },
      { id: "reproducible-tooling", name: text("Reproducible research tooling", "可复现研究工具"), status: "delivered" },
    ],
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
    tasks: [
      { id: "language-runtime", name: text("Language and runtime", "语言与运行时"), status: "delivered" },
      { id: "ownership-primitives", name: text("Ownership primitives", "所有权原语"), status: "active" },
      { id: "developer-sdk", name: text("Developer SDK", "开发者 SDK"), status: "planned" },
      { id: "legacy-experiment", name: text("Legacy experimental path", "早期实验方向"), status: "discontinued" },
    ],
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "active",
    summary: text(
      "Explore a continuously updated, composable AI service architecture that can make model capabilities long-running network resources.",
      "探索可持续更新和组合的 AI 服务架构，使模型能力可以作为网络中的长期运行资源。",
    ),
    tasks: [
      { id: "research-baseline", name: text("Research baseline", "研究基线"), status: "delivered" },
      { id: "service-architecture", name: text("AI service architecture", "AI 服务架构"), status: "active" },
      { id: "network-integration", name: text("Network integration", "网络集成"), status: "planned" },
    ],
  },
  {
    id: "minijam",
    name: "MiniJAM",
    status: "active",
    summary: text(
      "Build an execution network for shared public state, computation, and AI resources, while testing the boundaries of the JAM service model in real applications.",
      "建设面向公共状态、计算和 AI 等共享资源的执行网络，并继续验证 JAM 服务模型在真实应用中的边界。",
    ),
    tasks: [
      { id: "service-model", name: text("JAM service model", "JAM 服务模型"), status: "delivered" },
      { id: "shared-resources", name: text("Shared public resources", "共享公共资源"), status: "active" },
      { id: "execution-network", name: text("Execution network", "执行网络"), status: "planned" },
    ],
  },
  {
    id: "locus-ownership",
    name: "Locus & Ownership",
    status: "active",
    summary: text(
      "Create wallet-independent ownership and asset experiences so different identities and cryptographic systems can use a shared asset model.",
      "建立钱包无关的所有权与资产使用体验，使不同身份和密码体系能够使用统一的资产模型。",
    ),
    tasks: [
      { id: "identity-mapping", name: text("Cross-wallet identity mapping", "跨钱包身份映射"), status: "active" },
      { id: "shared-asset-model", name: text("Shared asset model", "统一资产模型"), status: "planned" },
    ],
  },
  {
    id: "mini-utility",
    name: "MINI Utility",
    status: "planned",
    summary: text(
      "Establish practical uses for MINI in service payments, resource access, and network settlement.",
      "逐步建立 MINI 在服务支付、资源使用与网络结算中的实际用途。",
    ),
    tasks: [
      { id: "service-payments", name: text("Service payments", "服务支付"), status: "planned" },
      { id: "network-settlement", name: text("Network settlement", "网络结算"), status: "planned" },
    ],
  },
  {
    id: "developer-ecosystem",
    name: "Developer Ecosystem",
    status: "active",
    summary: text(
      "Improve documentation, examples, SDKs, deployment flows, and developer tools to lower the cost of building third-party applications.",
      "完善文档、示例、SDK、部署流程和开发工具，降低第三方开发者进入生态的成本。",
    ),
    tasks: [
      { id: "documentation-examples", name: text("Documentation and examples", "文档与示例"), status: "delivered" },
      { id: "developer-sdk", name: text("Developer SDK", "开发者 SDK"), status: "active" },
      { id: "third-party-apps", name: text("Third-party applications", "第三方应用"), status: "planned" },
    ],
  },
];

export function mergeGenesisWorkItems(fallback: readonly GenesisWorkItem[], configured?: readonly GenesisWorkItem[]): readonly GenesisWorkItem[] {
  if (!configured?.length) return fallback;
  return configured.map((item) => {
    const defaultItem = fallback.find((candidate) => candidate.id === item.id);
    return defaultItem && !item.tasks?.length ? { ...defaultItem, ...item, tasks: defaultItem.tasks } : item;
  });
}
