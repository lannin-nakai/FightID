import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { PipelineStage } from "../services/mockAnalysisPipeline";

interface PipelineStatusProps {
  stages: PipelineStage[];
}

export const PipelineStatus = ({ stages }: PipelineStatusProps) => (
  <section className="glass-panel rounded-3xl p-5">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
          AI architecture
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">Mock analysis pipeline</h2>
      </div>
      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs text-slate-400">
        Plug-in ready
      </span>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {stages.map((stage) => {
        const isRunning = stage.status === "running";
        const isComplete = stage.status === "complete";

        return (
          <div
            className={`rounded-2xl border p-4 transition ${
              isRunning
                ? "border-orange-400/70 bg-orange-500/10"
                : isComplete
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-950/60"
            }`}
            key={stage.id}
          >
            <div className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin text-orange-300" />
              ) : (
                <Circle className="h-4 w-4 text-slate-500" />
              )}
              <h3 className="text-sm font-bold text-white">{stage.label}</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{stage.description}</p>
          </div>
        );
      })}
    </div>
  </section>
);
