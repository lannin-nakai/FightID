import { Shield, Swords, Target } from "lucide-react";
import type { FightStats, Fighter, FighterId } from "../types/fight";
import { formatDuration } from "../utils/time";

interface FighterComparisonProps {
  fighters: Record<FighterId, Fighter>;
  stats: FightStats;
}

const FighterCard = ({
  fighter,
  stats,
}: {
  fighter: Fighter;
  stats: FightStats["byFighter"][FighterId];
}) => (
  <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
    <div className="flex items-center gap-4">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${fighter.avatarGradient} text-2xl font-black text-white shadow-lg`}
      >
        {fighter.name
          .split(" ")
          .map((part) => part[0])
          .join("")}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {fighter.corner} corner · {fighter.stance}
        </p>
        <h3 className="text-xl font-black text-white">{fighter.name}</h3>
        <p className="text-sm text-slate-400">
          {fighter.record} · {fighter.reach}
        </p>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-3 gap-3">
      <div className="rounded-2xl bg-slate-900/80 p-3">
        <Swords className={`mb-2 h-4 w-4 ${fighter.accentClass}`} />
        <p className="text-2xl font-black text-white">{stats.totalStrikes}</p>
        <p className="text-xs text-slate-500">Strikes</p>
      </div>
      <div className="rounded-2xl bg-slate-900/80 p-3">
        <Target className={`mb-2 h-4 w-4 ${fighter.accentClass}`} />
        <p className="text-2xl font-black text-white">{stats.strikeAccuracy}%</p>
        <p className="text-xs text-slate-500">Accuracy</p>
      </div>
      <div className="rounded-2xl bg-slate-900/80 p-3">
        <Shield className={`mb-2 h-4 w-4 ${fighter.accentClass}`} />
        <p className="text-2xl font-black text-white">{stats.defensiveReactions}</p>
        <p className="text-xs text-slate-500">Defense</p>
      </div>
    </div>

    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div className="flex justify-between gap-3 border-b border-slate-800 pb-2">
        <dt className="text-slate-500">Significant</dt>
        <dd className="font-bold text-white">{stats.significantStrikes}</dd>
      </div>
      <div className="flex justify-between gap-3 border-b border-slate-800 pb-2">
        <dt className="text-slate-500">Takedowns</dt>
        <dd className="font-bold text-white">
          {stats.successfulTakedowns}/{stats.takedownAttempts}
        </dd>
      </div>
      <div className="flex justify-between gap-3 border-b border-slate-800 pb-2">
        <dt className="text-slate-500">Clinch time</dt>
        <dd className="font-bold text-white">{formatDuration(stats.clinchTime)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-b border-slate-800 pb-2">
        <dt className="text-slate-500">Knockdowns</dt>
        <dd className="font-bold text-white">{stats.knockdowns}</dd>
      </div>
    </dl>
  </div>
);

export const FighterComparison = ({ fighters, stats }: FighterComparisonProps) => (
  <section className="glass-panel rounded-3xl p-5">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
        Fighter comparison
      </p>
      <h2 className="mt-1 text-xl font-black text-white">Performance by corner</h2>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <FighterCard fighter={fighters.red} stats={stats.byFighter.red} />
      <FighterCard fighter={fighters.blue} stats={stats.byFighter.blue} />
    </div>
  </section>
);
