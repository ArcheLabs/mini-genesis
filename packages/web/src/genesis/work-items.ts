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
    id: "minijam",
    name: "MiniJAM",
    status: "active",
    summary: text(
      "Build the next generation of the MiniJAM network, extend PVM with GPU compute, and establish an incentive and subprotocol framework for an open ecosystem.",
      "建设下一代 MiniJAM 网络，将 PVM 扩展到 GPU 计算，并建立面向开放生态的激励与子协议体系。",
    ),
    tasks: [
      { id: "gpu-pvm", name: "GPU-PVM", summary: text("Introduce GPU compute to PVM, enabling JAM Services to run model training, inference, and other large-scale parallel workloads.", "为 PVM 引入 GPU 计算能力，使 JAM Service 能够执行模型训练、推理及其他大规模并行计算任务。"), status: "active" },
      { id: "incentive-protocol", name: text("Incentive Protocol", "激励协议"), summary: text("Complete ecosystem incentive infrastructure based on Alpha markets, staking, liquidity, and market-driven emissions, enabling projects to access launch resources and long-term incentives through real markets while preparing the foundation for MiniCells integration.", "完成基于 Alpha 市场、质押、流动性和市场排放的生态激励基础设施，让项目能够通过真实市场获得启动资源和长期激励，并为 MiniCells 接入做好准备。"), status: "planned" },
      { id: "minicells-training-subprotocol", name: text("MiniCells Training Subprotocol", "MiniCells 训练子协议"), summary: text("Build an open training mechanism on top of the Incentive Protocol, allowing participants to create training subnets, contribute compute and model improvements, and determine contribution acceptance and incentive rules through MiniCells validation and evaluation.", "在激励协议之上建立开放训练机制，允许参与者创建训练子网、贡献计算和模型成果，并根据 MiniCells 的验证与评估结果决定成果采用和激励规则。"), status: "planned" },
      { id: "next-generation-network", name: text("Next-Generation Network", "新一代网络"), summary: text("Launch the next MiniJAM network with GPU-PVM, the Incentive Protocol, and open subprotocol support, running real applications and compute workloads continuously.", "上线支持 GPU-PVM、激励协议和开放子协议的新一代 MiniJAM 网络，持续运行真实应用与计算负载。"), status: "planned" },
    ],
  },
  {
    id: "jamscript",
    name: "JamScript",
    status: "active",
    summary: text(
      "Advance JamScript from a JAM development language into a complete application development and runtime platform for JAM.",
      "将 JamScript 从 JAM 开发语言推进为完整的 JAM 应用开发与运行平台。",
    ),
    tasks: [
      { id: "jamscript-v1", name: "JamScript v1", summary: text("Deliver the first stable release of the language, compiler, type system, and Service Runtime, while continuing to improve numeric computation, memory management, and execution efficiency.", "完成语言、编译器、类型系统和 Service Runtime 的首个稳定版本，并继续优化数值计算、内存管理和执行效率。"), status: "active" },
      { id: "application-backend", name: "Application Backend", summary: text("Complete the JamScript Backend for production applications, providing unified handling of Transactions, Managed State, batching, finality, execution results, and application state access.", "完善面向真实应用的 JamScript Backend，统一处理 Transaction、Managed State、批处理、最终性、执行结果以及应用状态访问。"), status: "active" },
      { id: "minikernel", name: "MiniKernel", summary: text("Complete the service interaction framework for JAM Services and applications, enabling composable application execution models.", "完成面向 JAM Service 和应用的服务交互框架，构建可组合的应用执行模型。"), status: "planned" },
      { id: "developer-toolchain", name: text("Developer Toolchain", "开发工具链"), summary: text("Complete the SDK, Client, CLI, deployment, debugging, and version management workflows required to build and operate JAM Services end to end.", "完善 SDK、Client、CLI、部署、调试和版本管理，让开发者能够以完整工作流构建和运行 JAM Service。"), status: "active" },
    ],
  },
  {
    id: "ownership-abstraction",
    name: "Ownership Abstraction",
    status: "active",
    summary: text(
      "Decouple ownership from specific blockchain accounts, wallets, and cryptographic schemes, making Ownership a fundamental control primitive that applications can use directly.",
      "将所有权从特定区块链账户、钱包和密码学方案中解耦，使 Ownership 成为应用可以直接使用的基础控制原语。",
    ),
    tasks: [
      { id: "unified-ownership-primitive", name: text("Unified Ownership Primitive", "统一所有权原语"), summary: text("Continue refining a unified Ownership representation across different cryptographic systems so application state is no longer tied to a specific wallet or account format.", "继续完善不同密码学体系下的统一 Ownership 表达，让应用状态不再绑定某一种钱包或账户格式。"), status: "active" },
      { id: "ecosystem-compatibility-layer", name: text("Ecosystem Compatibility Layer", "生态兼容层"), summary: text("Build compatibility interfaces for existing ecosystems including EVM, Polkadot, and Solana, covering RPC, transactions, and wallet interaction so existing tools can connect directly to Ownership-based applications.", "围绕 EVM、Polkadot、Solana 等现有生态建立兼容接口，包括 RPC、交易和钱包交互，使已有工具能够直接连接基于 Ownership 的应用。"), status: "active" },
      { id: "programmable-ownership", name: text("Programmable Ownership", "可编程所有权"), summary: text("Extend multisig, delegation, composable control, and other programmable ownership models, enabling more flexible control over assets and application state.", "扩展多签、委托、组合控制及其他可编程控制模型，使资产和应用状态能够采用更加灵活的所有权规则。"), status: "planned" },
      { id: "new-cryptography-support", name: text("New Cryptography Support", "新密码学支持"), summary: text("Continue adding verifiable cryptographic schemes while preserving native extensibility for future ownership systems, including post-quantum cryptography.", "继续扩展可验证的密码学方案，并为后量子密码学等未来所有权类型保留原生扩展能力。"), status: "planned" },
    ],
  },
  {
    id: "minicells",
    name: "MiniCells",
    status: "active",
    summary: text(
      "Complete the first production Cellular Language Model and establish a model system that supports open training, independent evaluation, and continuous evolution.",
      "完成第一代正式版 Cellular Language Model，并建立能够开放训练、独立评估和持续演化的模型系统。",
    ),
    tasks: [
      { id: "clm-v1", name: "CLM v1", summary: text("Complete the first production Cellular Language Model, refining Cell architecture, routing, training, and model evolution mechanisms.", "完成首个正式版 Cellular Language Model，完善 Cell、路由、训练和模型持续演化机制。"), status: "active" },
      { id: "mixed-model-30b", name: text("30B Mixed Model", "30B 混合模型"), summary: text("Train the first 30B-scale mixed model as the primary MiniCells model and the foundation for the open training network.", "训练首个 30B 规模混合模型，作为 MiniCells 主模型和开放训练网络的基础。"), status: "planned" },
      { id: "model-evaluation-system", name: text("Model Evaluation System", "模型评估系统"), summary: text("Build an evaluation mechanism with independent Evaluators / Validators to assess capability gains, regressions, and stability in candidate contributions submitted by different training subnets.", "建立由独立 Evaluator / Validator 参与的模型评估机制，对不同训练子网提交的候选成果进行能力、退化和稳定性评估。"), status: "planned" },
      { id: "model-evolution-protocol", name: text("Model Evolution Protocol", "模型演化协议"), summary: text("Establish a standard process for candidate training results to enter the main model, allowing validated model contributions to be continuously incorporated into the canonical model.", "建立候选训练成果进入主模型的标准流程，使通过评估的模型贡献能够持续进入主模型。"), status: "planned" },
    ],
  },
  {
    id: "locus",
    name: "Locus",
    status: "active",
    summary: text(
      "Advance Locus from an experimental asset application into an open asset hub for mainstream users, enabling assets to move across wallets, applications, and interaction environments.",
      "将 Locus 从资产实验应用推进为面向普通用户的开放资产中心，让资产能够跨钱包、跨应用和跨交互环境使用。",
    ),
    tasks: [
      { id: "open-asset-protocol", name: text("Open Asset Protocol", "开放资产协议"), summary: text("Expand beyond fungible assets to support NFTs and additional asset types, with shared Ownership, transfer, and application interaction infrastructure.", "从同质化资产扩展到 NFT 等更多资产类型，使不同资产共享统一的 Ownership、转移和应用交互基础设施。"), status: "planned" },
      { id: "multi-ecosystem-integration", name: text("Multi-Ecosystem Integration", "多生态兼容"), summary: text("Support direct integration with external applications and platforms such as Telegram and GitHub.", "支持 Telegram、GitHub 等外部应用和平台直接接入 Locus。"), status: "active" },
      { id: "native-wallet-compatibility", name: text("Native Wallet Compatibility", "原生钱包兼容"), summary: text("Emulate RPC and native transaction formats from ecosystems such as EVM, Polkadot, and Solana, allowing different wallets to access Locus directly while converting native signatures into unified Ownership authorization.", "模拟 EVM、Polkadot、Solana 等生态的 RPC 与原生交易格式，让不同的钱包能够直接访问 Locus，并将原生签名转换为统一的 Ownership 授权。"), status: "planned" },
      { id: "secure-authorization", name: text("Secure Authorization", "安全授权"), summary: text("Make the actual effects of asset transfers, approvals, and transactions part of the signed payload, preventing applications from hiding unauthorized asset changes behind opaque calls.", "让资产转移、授权和交易的实际影响成为签名内容的一部分，确保应用无法通过隐藏调用改变用户未明确授权的资产。"), status: "planned" },
      { id: "open-asset-markets", name: text("Open Asset Markets", "开放资产市场"), summary: text("Expand beyond basic asset management into permissionless liquidity, swaps, and broader asset markets, allowing developers and users to build applications and markets directly around Locus assets.", "从基础资产管理进一步扩展到无许可流动性、兑换以及更多资产市场，使开发者和用户能够围绕 Locus 资产直接建立应用和市场。"), status: "planned" },
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
