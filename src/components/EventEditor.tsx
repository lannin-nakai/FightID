import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  EventImpact,
  EventResult,
  FightEvent,
  Fighter,
  FighterId,
  MovementType,
} from "../types/fight";
import { MOVEMENT_LABELS, RESULT_LABELS } from "../types/fight";

interface EventEditorProps {
  event?: FightEvent;
  fighters: Record<FighterId, Fighter>;
  maxDuration: number;
  onClose: () => void;
  onSave: (event: FightEvent) => void;
}

const movementOptions = Object.entries(MOVEMENT_LABELS) as [MovementType, string][];
const resultOptions = Object.entries(RESULT_LABELS) as [EventResult, string][];
const impactOptions: EventImpact[] = ["low", "medium", "high", "critical"];

const createBlankEvent = (): FightEvent => ({
  id: `evt-manual-${Date.now()}`,
  fighterId: "red",
  opponentId: "blue",
  movementType: "jab",
  label: "Manual event",
  result: "landed",
  impact: "medium",
  round: 1,
  timestamp: 0,
  durationSec: 1,
  confidence: 0.75,
  significant: false,
  notes: "Manually added by analyst.",
  poseFrameId: `pose-manual-${Date.now()}`,
});

export const EventEditor = ({
  event,
  fighters,
  maxDuration,
  onClose,
  onSave,
}: EventEditorProps) => {
  const initialEvent = useMemo(() => event ?? createBlankEvent(), [event]);
  const [draft, setDraft] = useState<FightEvent>(initialEvent);

  useEffect(() => {
    setDraft(initialEvent);
  }, [initialEvent]);

  const updateFighter = (fighterId: FighterId) => {
    setDraft((current) => ({
      ...current,
      fighterId,
      opponentId: fighterId === "red" ? "blue" : "red",
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <form
        className="glass-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          onSave({
            ...draft,
            label: draft.label.trim() || MOVEMENT_LABELS[draft.movementType],
            timestamp: Math.min(Math.max(0, draft.timestamp), maxDuration),
            confidence: Math.min(Math.max(0, draft.confidence), 1),
          });
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
              Manual correction
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              {event ? "Edit detected event" : "Add fight event"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Corrections update the timestamp list and fight statistics immediately.
            </p>
          </div>
          <button
            className="rounded-full border border-slate-700 p-2 text-slate-300 hover:text-white"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Event label
            </span>
            <input
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              value={draft.label}
              onChange={(inputEvent) =>
                setDraft((current) => ({ ...current, label: inputEvent.target.value }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Fighter
            </span>
            <select
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              value={draft.fighterId}
              onChange={(inputEvent) => updateFighter(inputEvent.target.value as FighterId)}
            >
              <option value="red">{fighters.red.name}</option>
              <option value="blue">{fighters.blue.name}</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Movement type
            </span>
            <select
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              value={draft.movementType}
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  movementType: inputEvent.target.value as MovementType,
                }))
              }
            >
              {movementOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Result
            </span>
            <select
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              value={draft.result}
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  result: inputEvent.target.value as EventResult,
                }))
              }
            >
              {resultOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Impact
            </span>
            <select
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              value={draft.impact}
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  impact: inputEvent.target.value as EventImpact,
                }))
              }
            >
              {impactOptions.map((impact) => (
                <option key={impact} value={impact}>
                  {impact}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Round
            </span>
            <input
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              max="5"
              min="1"
              type="number"
              value={draft.round}
              onChange={(inputEvent) =>
                setDraft((current) => ({ ...current, round: Number(inputEvent.target.value) }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Timestamp seconds
            </span>
            <input
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              min="0"
              type="number"
              value={draft.timestamp}
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  timestamp: Number(inputEvent.target.value),
                }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Duration seconds
            </span>
            <input
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              min="0.5"
              step="0.5"
              type="number"
              value={draft.durationSec}
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  durationSec: Number(inputEvent.target.value),
                }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="flex justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Confidence
              <span className="text-orange-300">{Math.round(draft.confidence * 100)}%</span>
            </span>
            <input
              className="range-accent h-12 w-full"
              max="1"
              min="0"
              step="0.01"
              type="range"
              value={draft.confidence}
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  confidence: Number(inputEvent.target.value),
                }))
              }
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
            <input
              checked={draft.significant}
              className="range-accent h-4 w-4"
              type="checkbox"
              onChange={(inputEvent) =>
                setDraft((current) => ({
                  ...current,
                  significant: inputEvent.target.checked,
                }))
              }
            />
            <span className="text-sm font-bold text-white">Significant event</span>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Analyst notes
            </span>
            <textarea
              className="min-h-28 w-full resize-y rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-orange-400"
              value={draft.notes}
              onChange={(inputEvent) =>
                setDraft((current) => ({ ...current, notes: inputEvent.target.value }))
              }
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-300 hover:text-white"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 rounded-2xl bg-orange-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-orange-300"
            type="submit"
          >
            <Save className="h-4 w-4" />
            Save event
          </button>
        </div>
      </form>
    </div>
  );
};
