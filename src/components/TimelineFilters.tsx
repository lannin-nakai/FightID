import { Filter } from "lucide-react";
import type { EventFilters, Fighter, FighterId, MovementType } from "../types/fight";
import { MOVEMENT_LABELS, RESULT_LABELS } from "../types/fight";

interface TimelineFiltersProps {
  filters: EventFilters;
  fighters: Record<FighterId, Fighter>;
  rounds: number[];
  onChange: (filters: EventFilters) => void;
}

const movementOptions = Object.entries(MOVEMENT_LABELS) as [MovementType, string][];
const resultOptions = Object.entries(RESULT_LABELS);

export const TimelineFilters = ({
  filters,
  fighters,
  rounds,
  onChange,
}: TimelineFiltersProps) => (
  <section className="glass-panel rounded-3xl p-5">
    <div className="mb-4 flex items-center gap-2">
      <Filter className="h-4 w-4 text-orange-300" />
      <h2 className="text-lg font-black text-white">Timeline filters</h2>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Movement
        </span>
        <select
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-400"
          value={filters.movementType}
          onChange={(event) =>
            onChange({ ...filters, movementType: event.target.value as EventFilters["movementType"] })
          }
        >
          <option value="all">All movements</option>
          {movementOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Fighter
        </span>
        <select
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-400"
          value={filters.fighterId}
          onChange={(event) =>
            onChange({ ...filters, fighterId: event.target.value as EventFilters["fighterId"] })
          }
        >
          <option value="all">Both fighters</option>
          <option value="red">{fighters.red.name}</option>
          <option value="blue">{fighters.blue.name}</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Round
        </span>
        <select
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-400"
          value={filters.round}
          onChange={(event) =>
            onChange({
              ...filters,
              round: event.target.value === "all" ? "all" : Number(event.target.value),
            })
          }
        >
          <option value="all">All rounds</option>
          {rounds.map((round) => (
            <option key={round} value={round}>
              Round {round}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Result
        </span>
        <select
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-400"
          value={filters.result}
          onChange={(event) =>
            onChange({ ...filters, result: event.target.value as EventFilters["result"] })
          }
        >
          <option value="all">All results</option>
          {resultOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="flex justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Confidence
          <span className="text-orange-300">{Math.round(filters.minConfidence * 100)}%+</span>
        </span>
        <input
          className="range-accent h-12 w-full"
          max="1"
          min="0"
          step="0.05"
          type="range"
          value={filters.minConfidence}
          onChange={(event) =>
            onChange({ ...filters, minConfidence: Number(event.target.value) })
          }
        />
      </label>
    </div>
  </section>
);
