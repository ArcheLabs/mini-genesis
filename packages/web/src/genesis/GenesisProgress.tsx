type GenesisProgressProps = {
  displayedProgress: number;
  displayedEmittedMini: bigint;
  emittedLabel: string;
  totalLabel: string;
  contributionBoundaryPercent: number | null;
  protectionLabel: string;
  protectionActive: boolean;
};

export function GenesisProgress({
  displayedProgress,
  displayedEmittedMini,
  emittedLabel,
  totalLabel,
  contributionBoundaryPercent,
  protectionLabel,
  protectionActive,
}: GenesisProgressProps) {
  const hasBoundary = contributionBoundaryPercent !== null;

  return <div className="progress-inline">
    <div className="progress-top">
      <strong key={`progress-${displayedEmittedMini}`} className="emission-pulse">{displayedProgress.toFixed(1)}%</strong>
    </div>
    <div className={`progress-visual ${hasBoundary ? "" : "without-boundary"}`}>
      <div className="progress-track" role="progressbar" aria-label="Genesis emission progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayedProgress}>
        {hasBoundary && <div className="progress-protection-region" style={{ left: `${contributionBoundaryPercent}%` }} aria-hidden="true" />}
        <div className="progress-fill" style={{ width: `${displayedProgress}%` }} />
        {hasBoundary && <div className={`progress-phase-boundary ${protectionActive ? "is-active" : ""}`} style={{ left: `${contributionBoundaryPercent}%` }} aria-hidden="true">
          <span className="progress-phase-label">{protectionLabel}</span>
        </div>}
      </div>
    </div>
    <div className="progress-meta">
      <span key={`emitted-${displayedEmittedMini}`} className="emission-pulse">{emittedLabel}</span>
      <span>{totalLabel}</span>
    </div>
  </div>;
}
