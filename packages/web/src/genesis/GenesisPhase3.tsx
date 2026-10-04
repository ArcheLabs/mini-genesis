import { SectionHeading } from "../components/SectionHeading";
import { LockIcon, NetworkIcon } from "../components/SectionIcons";

type Language = "zh-CN" | "en";

export function GenesisPhase3({ language }: { language: Language }) {
  const zh = language === "zh-CN";
  return <section className="stage-panel phase3-panel" data-testid="genesis-phase3" data-phase-state="locked">
    <div className="phase3-visual" aria-hidden="true">
      <svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice">
        <path className="phase3-grid" d="M0 70H800M0 140H800M0 210H800M0 280H800M0 350H800M80 0V420M160 0V420M240 0V420M320 0V420M400 0V420M480 0V420M560 0V420M640 0V420M720 0V420" />
        <path className="phase3-curve" d="M70 330C190 320 220 255 330 250S480 175 545 180s100-73 185-120" />
        <path className="phase3-network" d="m128 282 106-80 116 35 103-91 108 30 112-106M234 202l17 116 99-81m0 0 103 78 99-141m0 0 9 147 119-41" />
        <g className="phase3-nodes"><circle cx="128" cy="282" r="5" /><circle cx="234" cy="202" r="5" /><circle cx="251" cy="318" r="5" /><circle cx="350" cy="237" r="5" /><circle cx="453" cy="146" r="5" /><circle cx="556" cy="176" r="5" /><circle cx="565" cy="323" r="5" /><circle cx="677" cy="70" r="5" /><circle cx="684" cy="282" r="5" /></g>
      </svg>
    </div>
    <div className="phase3-copy">
      <SectionHeading size="default" level={1} icon={<NetworkIcon />}>Genesis III</SectionHeading>
      <p className="phase3-subtitle">{zh ? "流动性积累" : "Liquidity Accumulation"}</p>
      <p className="phase3-locked"><LockIcon />{zh ? "尚未开放" : "Not yet open"}</p>
      <p className="phase3-transition">{zh ? "Genesis II 完成后进入下一阶段" : "Begins after Genesis II is complete"}</p>
    </div>
  </section>;
}
