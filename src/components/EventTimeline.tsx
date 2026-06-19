import { Edit3, Plus, Trash2 } from "lucide-react";
import type { FightEvent, Fighter, FighterId, PoseFrame } from "../types/fight";
import { MOVEMENT_LABELS, RESULT_LABELS } from "../types/fight";
import { formatTimestamp } from "../utils/time";
import { PoseSilhouette } from "./PoseSilhouette";

interface EventTimelineProps {
  events: FightEvent[];
  fighters: Record<FighterId, Fighter>;
  poseFrames: PoseFrame[];
  selectedEventId?: string;
  onSelect: (event: FightEvent) => void;
  onEdit: (event: FightEvent) => void;
  onDelete: (eventId: string) => void;
  onAdd: () => void;
}

const impactClass: Record<FightEvent["impact"], string> = {
  low: "border-slate-700 bg-slate-900/60 text-slate-300",
  medium: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  high: "border-orange-400/40 bg-orange-500/10 text-orange-200",
  critical: "border-rose-400/50 bg-rose-500/15 text-rose-200",
};

export const EventTimeline = ({
  events,
  fighters,
  poseFrames,
  selectedEventId,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
}: EventTimelineProps) => {
  const poseById = Object.fromEntries(poseFrames.map((pose) => [pose.id, pose]));

  return (
    <section className="glass-panel flex max-h-[920px] min-h-[620px] flex-col rounded-3xl">
      <div className="flex items-center justify-between border-b border-slate-800 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
            Event timeline
          </p>
          <h2 className="mt-1 text-xl font-black text-white">{events.length} detected moments</h2>
        </div>
        <button
          className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-orange-200"
          type="button"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          Add event
        </button>
      </div>

      <div className="scrollbar-slim flex-1 space-y-3 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            No events match the active filters.
          </div>
        ) : (
          events.map((event) => {
            const fighter = fighters[event.fighterId];
            const poseFrame = poseById[event.poseFrameId];
            const isSelected = event.id === selectedEventId;

            return (
              <article
                className={`group rounded-3xl border p-3 transition ${
                  isSelected
                    ? "border-orange-400/80 bg-orange-500/10 shadow-lg shadow-orange-950/30"
                    : "border-slate-800 bg-slate-950/55 hover:border-slate-600"
                }`}
                key={event.id}
              >
                <button
                  className="grid w-full gap-3 text-left sm:grid-cols-[132px_minmax(0,1fr)]"
                  type="button"
                  onClick={() => onSelect(event)}
                >
                  <PoseSilhouette compact fighter={fighter} frame={poseFrame} />

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`relative rounded-full px-3 py-1 text-xs font-black ${
                          isSelected ? "pulse-ring bg-orange-400 text-slate-950" : "bg-slate-900 text-orange-200"
                        }`}
                      >
                        {formatTimestamp(event.timestamp)}
                      </span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                        R{event.round}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${impactClass[event.impact]}`}>
                        {event.impact}
                      </span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                        {Math.round(event.confidence * 100)}% conf.
                      </span>
                    </div>

                    <h3 className="truncate text-lg font-black text-white">{event.label}</h3>
                    <p className={`mt-1 text-sm font-bold ${fighter.accentClass}`}>
                      {fighter.name} · {MOVEMENT_LABELS[event.movementType]} ·{" "}
                      {RESULT_LABELS[event.result]}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                      {event.notes}
                    </p>
                  </div>
                </button>

                <div className="mt-3 flex justify-end gap-2 border-t border-slate-800 pt-3 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400 hover:text-white"
                    type="button"
                    onClick={() => onEdit(event)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    className="flex items-center gap-2 rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/10"
                    type="button"
                    onClick={() => onDelete(event.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
