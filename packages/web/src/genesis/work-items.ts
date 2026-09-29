import type { GenesisLocalizedText, GenesisWorkItem } from "../config/manifest";

export type { GenesisLocalizedText, GenesisWorkItem };

const text = (en: string, zhCN: string): GenesisLocalizedText => ({ en, "zh-CN": zhCN });

/**
 * Canonical bilingual Genesis I editorial copy. Historical manifests continue
 * to own project statuses and evidence links; this copy can evolve without
 * rewriting the Genesis I deployment record.
 */
export const genesisPhase1WorkItems: readonly GenesisWorkItem[] = [
  {
    id: "minijam",
    name: "MiniJAM",
    status: "delivered",
    summary: text(
      "Establish the first-generation MiniJAM network, providing a complete environment for JAM Service deployment, execution, and state evolution.",
      "建立第一代 MiniJAM 网络，为 JAM Service 提供从部署、执行到状态演化的完整环境。",
    ),
    tasks: [
      { id: "stage-1-network", name: text("Stage-1 Network", "Stage-1 网络"), summary: text("Complete the first-generation MiniJAM network and establish the foundations for Service execution and state evolution.", "完成 MiniJAM 第一代可运行网络，建立 Service 执行与状态演化基础。"), status: "delivered" },
      { id: "node-infrastructure", name: text("Node Infrastructure", "节点基础设施"), summary: text("Integrate Node, Worker, Formal RPC, and other core runtime components into an engineered system.", "完成 Node、Worker、Formal RPC 等核心运行组件的工程化整合。"), status: "delivered" },
      { id: "minijam-client", name: text("MiniJAM Client", "MiniJAM Client"), summary: text("Deliver core capabilities for a new-generation client, providing a unified entry point for connecting to and calling MiniJAM.", "完成新一代客户端基础能力，为应用连接和调用 MiniJAM 提供统一入口。"), status: "delivered" },
      { id: "service-development-flow", name: text("Service Development Flow", "Service 开发流程"), summary: text("Connect the foundational Service workflow from build and deployment through calls and state reads.", "打通 Service 从构建、部署到调用和状态读取的基础链路。"), status: "delivered" },
    ],
  },
  {
    id: "jamscript",
    name: "JamScript",
    status: "delivered",
    summary: text(
      "The first-generation language, runtime, and toolchain for JAM application development.",
      "面向 JAM 应用开发的第一代语言、运行时与工具链。",
    ),
    tasks: [
      { id: "jamscript-language", name: text("JamScript Language", "JamScript 语言"), summary: text("Establish a TypeScript-style language for JAM application development, reducing the complexity of building PVM Services directly.", "建立 TypeScript 风格的 JAM 应用开发语言，降低直接开发 PVM Service 的复杂度。"), status: "delivered" },
      { id: "compiler-toolchain", name: text("Compiler Toolchain", "编译工具链"), summary: text("Complete the build flow from JamScript to executable JAM/PVM Services.", "完成 JamScript 到 JAM/PVM 可执行 Service 的构建流程。"), status: "delivered" },
      { id: "service-runtime", name: text("Service Runtime", "Service Runtime"), summary: text("Establish the JamScript Service runtime model and encapsulate state and JAM execution details.", "建立 JamScript Service 的运行时模型，封装状态与 JAM 执行细节。"), status: "delivered" },
      { id: "developer-tools", name: text("Developer Tools", "开发工具"), summary: text("Provide foundational CLI and SDK capabilities for building, deploying, and developing applications.", "提供构建、部署与应用开发所需的基础 CLI 和 SDK 能力。"), status: "delivered" },
      { id: "backend", name: "Backend", summary: text("Establish application-facing backend infrastructure so users and applications can interact directly with JAM and use MINI as Gas.", "建立面向应用的后端基础设施，支持用户和应用直接和 JAM 交互，并使用 MINI 作为 Gas。"), status: "delivered" },
    ],
  },
  {
    id: "jam-computer",
    name: "JAM Computer",
    status: "delivered",
    summary: text(
      "A first-generation product experiment in native JAM application interaction, with release delayed.",
      "对 JAM 原生应用交互形态进行的第一代产品实验，延迟发布。",
    ),
    tasks: [
      { id: "application-environment", name: text("Application Environment", "应用运行环境"), summary: text("Organize JAM Services, state, and user interaction into an application environment that can be used directly.", "将 JAM Service、状态与用户交互组织成可直接使用的应用环境。"), status: "delivered" },
      { id: "user-interface-experiment", name: text("User Interface Experiment", "用户界面实验"), summary: text("Explore product experiences where everyday users use JAM Services directly instead of facing the protocol layer.", "探索普通用户直接使用 JAM Service，而不是直接面对协议层的产品方式。"), status: "delivered" },
    ],
  },
  {
    id: "ownership-abstraction",
    name: "Ownership Abstraction",
    status: "delivered",
    summary: text(
      "A first-stage architectural implementation that shifts from accounts to proofs of ownership.",
      "从“账户”转向“所有权证明”的第一阶段架构实现。",
    ),
    tasks: [
      { id: "ownership-model", name: text("Ownership Model", "所有权模型"), summary: text("Abstract asset control as verifiable Ownership rather than binding it to a single account format.", "将资产控制权抽象为可验证的 Ownership，而不是固定绑定某一种账户格式。"), status: "delivered" },
      { id: "external-identity-integration", name: text("External Identity Integration", "外部身份接入"), summary: text("Explore how different identity and cryptographic systems, including EVM and Matrix, can control JAM application state.", "探索 EVM、Matrix 等不同身份或密码学体系控制 JAM 应用状态的方式。"), status: "delivered" },
      { id: "wallet-decoupling", name: text("Wallet Decoupling", "钱包解耦"), summary: text("Verify that user identity and signing methods can be separated from underlying asset state, allowing different cryptographic primitives to interact directly with the chain.", "验证应用可以将用户身份、签名方式与底层资产状态分离，支持不同密码学原语直接和链交互。"), status: "delivered" },
    ],
  },
  {
    id: "lucos",
    name: "Lucos",
    status: "delivered",
    summary: text(
      "A first-generation JAM-native asset application and asset-management experiment.",
      "第一代 JAM 原生资产应用与资产管理实验。",
    ),
    tasks: [
      { id: "asset-hub-prototype", name: text("Asset Hub Prototype", "资产中心原型"), summary: text("Complete an application prototype for creating, holding, querying, and transferring JAM-native assets.", "完成 JAM 原生资产创建、持有、查询和转移的应用原型。"), status: "delivered" },
      { id: "asset-state-model", name: text("Asset State Model", "资产状态模型"), summary: text("Validate an implementation path that manages asset state directly as JAM Service state.", "验证将资产状态直接作为 JAM Service 状态进行管理的实现路径。"), status: "delivered" },
      { id: "cross-identity-exploration", name: text("Cross-Identity Exploration", "跨身份探索"), summary: text("Begin exploring an asset-ownership direction that is not bound to a single wallet or account system.", "开始探索资产所有权不与单一钱包或账户体系绑定的产品方向。"), status: "delivered" },
    ],
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "delivered",
    summary: text(
      "First-stage AI research centered on continuous-learning models.",
      "围绕持续学习模型进行的第一阶段 AI 研究。",
    ),
    tasks: [
      { id: "continuous-learning-model", name: text("Continuous-Learning Model", "持续学习模型"), summary: text("Build the first CLM prototype, study continuous learning and state evolution, and validate early training and learning mechanisms.", "建立 CLM 第一代原型，研究模型持续学习与状态演化，完成早期模型训练与学习机制验证。"), status: "delivered" },
      { id: "research-tools", name: text("Research Tools", "研究工具"), summary: text("Build reproducible tools for training, testing, and experimentation.", "建立可重复运行的训练、测试和实验工具。"), status: "delivered" },
      { id: "hybrid-clm", name: text("Hybrid CLM", "混合 CLM"), summary: text("Complete a hybrid CLM model based on 1B MoE and run initial benchmarks.", "完成基于 1B MoE 的混合 CLM 模型，并进行前期基准测试。"), status: "delivered" },
      { id: "native-jam-training", name: text("JAM-Native Training", "JAM 原生训练"), summary: text("Complete simple CLM training in the PVM/MiniJAM execution environment.", "完成在 PVM / MiniJAM 执行环境中进行简单的 CLM 训练。"), status: "delivered" },
    ],
  },
  {
    id: "zkjam",
    name: "ZkJAM",
    status: "discontinued",
    summary: text(
      "Early research into combining zero-knowledge proofs with JAM execution.",
      "对零知识证明与 JAM 执行结合进行的早期研究。",
    ),
    tasks: [
      { id: "zk-execution-research", name: text("Zero-Knowledge Execution Research", "零知识执行研究"), summary: text("Study technical approaches for using zero-knowledge proofs to verify JAM/PVM computation results.", "调研使用零知识证明验证 JAM / PVM 计算结果的技术路线。"), status: "delivered" },
      { id: "architecture-exploration", name: text("Architecture Exploration", "架构探索"), summary: text("Complete an initial architecture study of how ZK can be combined with JAM Service execution.", "完成 ZK 与 JAM Service 执行结合方式的初步架构研究。"), status: "delivered" },
      { id: "feasibility-assessment", name: text("Feasibility Assessment", "可行性评估"), summary: text("Conduct an early assessment of proof-generation and verification costs and engineering complexity.", "对证明生成、验证成本和工程复杂度进行了早期评估。"), status: "delivered" },
      { id: "route-termination", name: text("Route Termination", "路线终止"), summary: text("Further MiniCells research into state and privacy found that ZK was no longer necessary. ZkJAM development was subsequently discontinued, while its findings were retained as Genesis I research outcomes.", "在对 MiniCells 的状态与隐私进行进一步研究后，发现 ZK 已不是必要条件。ZkJAM 后续停止继续开发，但相关研究结论作为 Genesis I 的研发成果保留。"), status: "discontinued" },
    ],
  },
];
export const genesisPhase1ResearchHistory: readonly GenesisWorkItem[] = [
  {
    id: "zkjam",
    name: "ZkJAM",
    status: "discontinued",
    summary: text(
      "Early research into zero-knowledge proofs and JAM execution was retained as a Genesis I research outcome after ZkJAM development was discontinued.",
      "ZkJAM 停止开发后，零知识证明与 JAM 执行结合的早期研究结论作为 Genesis I 研发成果保留。",
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

/**
 * Keep Genesis I wording in the frontend while preserving status and evidence
 * metadata from the immutable historical manifests.
 */
export function resolveGenesisPhase1WorkItems(configured?: readonly GenesisWorkItem[], researchHistory?: readonly GenesisWorkItem[]): readonly GenesisWorkItem[] {
  const stateById = new Map([...configured ?? [], ...researchHistory ?? []].map((item) => [item.id, item]));
  return genesisPhase1WorkItems.map((item) => {
    const historicalState = stateById.get(item.id);
    return historicalState
      ? { ...item, status: historicalState.status, evidenceUrl: historicalState.evidenceUrl }
      : item;
  });
}
