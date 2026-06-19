import type { Fighter, PoseFrame } from "../types/fight";
import { MOVEMENT_LABELS } from "../types/fight";

interface PoseSilhouetteProps {
  frame?: PoseFrame;
  fighter?: Fighter;
  compact?: boolean;
}

const connections = [
  ["head", "neck"],
  ["neck", "lead_shoulder"],
  ["neck", "rear_shoulder"],
  ["lead_shoulder", "lead_elbow"],
  ["lead_elbow", "lead_hand"],
  ["rear_shoulder", "rear_elbow"],
  ["rear_elbow", "rear_hand"],
  ["neck", "hip"],
  ["hip", "lead_knee"],
  ["lead_knee", "lead_foot"],
  ["hip", "rear_knee"],
  ["rear_knee", "rear_foot"],
];

export const PoseSilhouette = ({ frame, fighter, compact = false }: PoseSilhouetteProps) => {
  if (!frame || !fighter) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 text-xs text-slate-500">
        No pose frame selected
      </div>
    );
  }

  const points = Object.fromEntries(frame.keypoints.map((point) => [point.id, point]));
  const accent = fighter.id === "red" ? "#fb923c" : "#22d3ee";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 ${
        compact ? "p-2" : "p-4"
      }`}
    >
      <div className="absolute inset-0 fight-grid opacity-40" />
      <svg
        aria-label={`${fighter.name} pose silhouette for ${MOVEMENT_LABELS[frame.movementType]}`}
        className="relative z-10 h-full min-h-36 w-full"
        role="img"
        viewBox="0 0 100 100"
      >
        <defs>
          <filter id={`glow-${frame.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {connections.map(([from, to]) => {
          const start = points[from];
          const end = points[to];

          if (!start || !end) {
            return null;
          }

          const highlighted =
            frame.highlightedJoints.includes(from) || frame.highlightedJoints.includes(to);

          return (
            <line
              filter={highlighted ? `url(#glow-${frame.id})` : undefined}
              key={`${from}-${to}`}
              stroke={highlighted ? accent : "rgba(148, 163, 184, 0.72)"}
              strokeLinecap="round"
              strokeWidth={highlighted ? 4 : 2.4}
              x1={start.x}
              x2={end.x}
              y1={start.y}
              y2={end.y}
            />
          );
        })}
        {frame.keypoints.map((point) => {
          const highlighted = frame.highlightedJoints.includes(point.id);

          return (
            <circle
              cx={point.x}
              cy={point.y}
              fill={highlighted ? accent : "#cbd5e1"}
              filter={highlighted ? `url(#glow-${frame.id})` : undefined}
              key={point.id}
              r={highlighted ? 3.4 : 2.2}
            >
              <title>{point.label}</title>
            </circle>
          );
        })}
      </svg>
      {!compact && (
        <div className="relative z-10 mt-2 flex items-center justify-between text-xs">
          <span className={`font-bold ${fighter.accentClass}`}>{fighter.name}</span>
          <span className="text-slate-400">{MOVEMENT_LABELS[frame.movementType]}</span>
        </div>
      )}
    </div>
  );
};
