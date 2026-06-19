import { Download, ListChecks } from "lucide-react";
import type { FightAnalysis } from "../types/fight";
import { MOVEMENT_LABELS, RESULT_LABELS } from "../types/fight";
import { formatDuration, formatTimestamp } from "../utils/time";

interface SummaryScreenProps {
  analysis: FightAnalysis;
}

export const SummaryScreen = ({ analysis }: SummaryScreenProps) => {
  const { fighters, stats } = analysis;

  return (
    <section className="glass-panel rounded-3xl p-6">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Summary report
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">{analysis.title}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {analysis.venue} · {analysis.date} · {formatDuration(analysis.duration)}
          </p>
        </div>
        <button
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-200 hover:border-cyan-400/70 hover:text-white"
          type="button"
        >
          <Download className="h-4 w-4" />
          Export mock report
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Events detected", stats.eventCount],
          ["Average confidence", `${stats.averageConfidence}%`],
          [
            "Total strikes",
            stats.byFighter.red.totalStrikes + stats.byFighter.blue.totalStrikes,
          ],
          [
            "Knockdowns",
            stats.byFighter.red.knockdowns + stats.byFighter.blue.knockdowns,
          ],
        ].map(([label, value]) => (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {(["red", "blue"] as const).map((fighterId) => {
          const fighter = fighters[fighterId];
          const fighterStats = stats.byFighter[fighterId];

          return (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5" key={fighterId}>
              <h3 className={`text-xl font-black ${fighter.accentClass}`}>{fighter.name}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <dt className="text-slate-500">Total strikes</dt>
                  <dd className="mt-1 text-2xl font-black text-white">
                    {fighterStats.totalStrikes}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <dt className="text-slate-500">Significant strikes</dt>
                  <dd className="mt-1 text-2xl font-black text-white">
                    {fighterStats.significantStrikes}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <dt className="text-slate-500">Accuracy</dt>
                  <dd className="mt-1 text-2xl font-black text-white">
                    {fighterStats.strikeAccuracy}%
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <dt className="text-slate-500">Takedowns</dt>
                  <dd className="mt-1 text-2xl font-black text-white">
                    {fighterStats.successfulTakedowns}/{fighterStats.takedownAttempts}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <dt className="text-slate-500">Feints</dt>
                  <dd className="mt-1 text-2xl font-black text-white">
                    {fighterStats.feints}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-900/70 p-3">
                  <dt className="text-slate-500">Defense</dt>
                  <dd className="mt-1 text-2xl font-black text-white">
                    {fighterStats.defensiveReactions}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-orange-300" />
          <h3 className="text-xl font-black text-white">Full timestamped event list</h3>
        </div>
        <div className="scrollbar-slim max-h-[460px] overflow-y-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Round</th>
                <th className="px-3 py-3">Fighter</th>
                <th className="px-3 py-3">Movement</th>
                <th className="px-3 py-3">Result</th>
                <th className="px-3 py-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {analysis.events.map((event) => {
                const fighter = fighters[event.fighterId];

                return (
                  <tr className="border-t border-slate-800" key={event.id}>
                    <td className="px-3 py-3 font-mono text-orange-200">
                      {formatTimestamp(event.timestamp)}
                    </td>
                    <td className="px-3 py-3 text-slate-300">R{event.round}</td>
                    <td className={`px-3 py-3 font-bold ${fighter.accentClass}`}>
                      {fighter.name}
                    </td>
                    <td className="px-3 py-3 text-white">
                      {MOVEMENT_LABELS[event.movementType]}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {RESULT_LABELS[event.result]}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {Math.round(event.confidence * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
