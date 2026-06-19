import { Activity, BarChart3, Clock, Crosshair, TrendingUp } from "lucide-react";
import type { FightStats, Fighter, FighterId } from "../types/fight";
import { formatDuration, formatTimestamp } from "../utils/time";

interface StatsDashboardProps {
  fighters: Record<FighterId, Fighter>;
  stats: FightStats;
}

const maxBreakdownValue = (stats: FightStats): number =>
  Math.max(
    1,
    ...Object.values(stats.byFighter.red.strikeTypeBreakdown),
    ...Object.values(stats.byFighter.blue.strikeTypeBreakdown),
  );

export const StatsDashboard = ({ fighters, stats }: StatsDashboardProps) => {
  const maxStrikeType = maxBreakdownValue(stats);
  const redStats = stats.byFighter.red;
  const blueStats = stats.byFighter.blue;
  const totalClinch = redStats.clinchTime + blueStats.clinchTime;

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
            Fight stats
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Live analysis dashboard</h2>
        </div>
        <p className="text-sm text-slate-400">
          {stats.eventCount} events · {stats.averageConfidence}% avg confidence
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <Activity className="mb-3 h-5 w-5 text-orange-300" />
          <p className="text-3xl font-black text-white">
            {redStats.totalStrikes + blueStats.totalStrikes}
          </p>
          <p className="text-sm text-slate-500">Total strikes detected</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <Crosshair className="mb-3 h-5 w-5 text-cyan-300" />
          <p className="text-3xl font-black text-white">
            {redStats.significantStrikes + blueStats.significantStrikes}
          </p>
          <p className="text-sm text-slate-500">Significant strikes</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <BarChart3 className="mb-3 h-5 w-5 text-emerald-300" />
          <p className="text-3xl font-black text-white">
            {redStats.successfulTakedowns + blueStats.successfulTakedowns}/
            {redStats.takedownAttempts + blueStats.takedownAttempts}
          </p>
          <p className="text-sm text-slate-500">Successful takedowns</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <Clock className="mb-3 h-5 w-5 text-rose-300" />
          <p className="text-3xl font-black text-white">{formatDuration(totalClinch)}</p>
          <p className="text-sm text-slate-500">Tracked clinch time</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
          <h3 className="mb-4 text-lg font-black text-white">Strike type breakdown</h3>
          <div className="space-y-4">
            {Object.keys(redStats.strikeTypeBreakdown).map((label) => {
              const redValue = redStats.strikeTypeBreakdown[label] ?? 0;
              const blueValue = blueStats.strikeTypeBreakdown[label] ?? 0;

              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">{label}</span>
                    <span className="font-mono text-slate-500">
                      {redValue} / {blueValue}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-orange-400"
                        style={{ width: `${(redValue / maxStrikeType) * 100}%` }}
                      />
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${(blueValue / maxStrikeType) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-300" />
            <h3 className="text-lg font-black text-white">Momentum timeline</h3>
          </div>
          <div className="space-y-3">
            {stats.momentumTimeline.slice(-8).map((point) => (
              <div className="rounded-2xl bg-slate-900/70 p-3" key={`${point.timestamp}-${point.label}`}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-mono text-orange-200">
                    R{point.round} · {formatTimestamp(point.timestamp)}
                  </span>
                  <span className="truncate text-slate-400">{point.label}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${point.red}%` }} />
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {point.red}-{point.blue}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${point.blue}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
        <h3 className="mb-4 text-lg font-black text-white">Round-by-round stats</h3>
        <div className="grid gap-3 xl:grid-cols-3">
          {stats.roundStats.map((round) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4" key={round.round}>
              <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400">
                Round {round.round}
              </p>
              {(["red", "blue"] as FighterId[]).map((fighterId) => {
                const fighterStats = round.byFighter[fighterId];
                const fighter = fighters[fighterId];

                return (
                  <div className="mb-3 last:mb-0" key={fighterId}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className={`font-bold ${fighter.accentClass}`}>{fighter.name}</span>
                      <span className="text-slate-400">
                        {fighterStats.totalStrikes} str · {fighterStats.strikeAccuracy}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          fighterId === "red" ? "bg-orange-400" : "bg-cyan-400"
                        }`}
                        style={{
                          width: `${Math.min(100, round.momentumScore[fighterId] * 8)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
