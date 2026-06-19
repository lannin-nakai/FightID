import { BrainCircuit, ChevronRight, DatabaseZap, RadioTower, Trophy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { createPoseFrame, mockFightAnalysis } from "./data/mockFight";
import { EventEditor } from "./components/EventEditor";
import { EventTimeline } from "./components/EventTimeline";
import { FighterComparison } from "./components/FighterComparison";
import { PipelineStatus } from "./components/PipelineStatus";
import { StatsDashboard } from "./components/StatsDashboard";
import { SummaryScreen } from "./components/SummaryScreen";
import { TimelineFilters } from "./components/TimelineFilters";
import { UploadPanel } from "./components/UploadPanel";
import { VideoStage } from "./components/VideoStage";
import {
  createPipelineStages,
  runFightAnalysis,
  type PipelineStage,
} from "./services/mockAnalysisPipeline";
import type { EventFilters, FightAnalysis, FightEvent, VideoSource } from "./types/fight";
import { aggregateFightStats } from "./utils/fightStats";

type HeaderMetric = {
  label: string;
  value: string | number;
  Icon: typeof BrainCircuit;
};

const defaultFilters: EventFilters = {
  movementType: "all",
  fighterId: "all",
  round: "all",
  result: "all",
  minConfidence: 0,
};

const sampleSource: VideoSource = {
  kind: "sample",
  label: "Sample fight: Voss vs Kane",
};

const sortEvents = (events: FightEvent[]) =>
  [...events].sort((left, right) => left.timestamp - right.timestamp);

const updateAnalysisEvents = (
  analysis: FightAnalysis,
  events: FightEvent[],
  poseFrames = analysis.poseFrames,
): FightAnalysis => {
  const sortedEvents = sortEvents(events);

  return {
    ...analysis,
    events: sortedEvents,
    poseFrames,
    stats: aggregateFightStats(sortedEvents, analysis.rounds),
  };
};

function App() {
  const [analysis, setAnalysis] = useState<FightAnalysis>(mockFightAnalysis);
  const [source, setSource] = useState<VideoSource>(sampleSource);
  const [analyzedSource, setAnalyzedSource] = useState<VideoSource>(sampleSource);
  const [filters, setFilters] = useState<EventFilters>(defaultFilters);
  const [stages, setStages] = useState<PipelineStage[]>(createPipelineStages());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(
    analysis.events[0]?.id,
  );
  const [seekRequest, setSeekRequest] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<FightEvent | undefined>();
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [activeView, setActiveView] = useState<"breakdown" | "summary">("breakdown");

  const selectedEvent = useMemo(
    () => analysis.events.find((event) => event.id === selectedEventId) ?? analysis.events[0],
    [analysis.events, selectedEventId],
  );

  const selectedPoseFrame = useMemo(
    () => analysis.poseFrames.find((pose) => pose.id === selectedEvent?.poseFrameId),
    [analysis.poseFrames, selectedEvent?.poseFrameId],
  );

  const filteredEvents = useMemo(
    () =>
      analysis.events.filter((event) => {
        if (filters.movementType !== "all" && event.movementType !== filters.movementType) {
          return false;
        }

        if (filters.fighterId !== "all" && event.fighterId !== filters.fighterId) {
          return false;
        }

        if (filters.round !== "all" && event.round !== filters.round) {
          return false;
        }

        if (filters.result !== "all" && event.result !== filters.result) {
          return false;
        }

        return event.confidence >= filters.minConfidence;
      }),
    [analysis.events, filters],
  );

  const isAnalysisStale =
    source.kind !== analyzedSource.kind ||
    source.label !== analyzedSource.label ||
    source.src !== analyzedSource.src;

  const handleSourceChange = (nextSource: VideoSource) => {
    setSource(nextSource);
    setStages(createPipelineStages());
    setSeekRequest(null);
  };

  const handleAnalyze = async (sourceOverride?: VideoSource) => {
    const sourceToAnalyze = sourceOverride ?? source;

    setSource(sourceToAnalyze);
    setIsAnalyzing(true);

    try {
      const nextAnalysis = await runFightAnalysis(sourceToAnalyze, setStages);
      setAnalysis(nextAnalysis);
      setAnalyzedSource(sourceToAnalyze);
      setSelectedEventId(nextAnalysis.events[0]?.id);
      setSeekRequest(nextAnalysis.events[0]?.timestamp ?? null);
      setActiveView("breakdown");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectEvent = (event: FightEvent) => {
    setSelectedEventId(event.id);
    setSeekRequest(event.timestamp);
  };

  const handleSeekHandled = useCallback(() => {
    setSeekRequest(null);
  }, []);

  const handleDeleteEvent = (eventId: string) => {
    setAnalysis((current) => {
      const deletedEvent = current.events.find((event) => event.id === eventId);
      const nextEvents = current.events.filter((event) => event.id !== eventId);
      const nextPoseFrames = deletedEvent
        ? current.poseFrames.filter((pose) => pose.id !== deletedEvent.poseFrameId)
        : current.poseFrames;

      return updateAnalysisEvents(current, nextEvents, nextPoseFrames);
    });

    if (selectedEventId === eventId) {
      const nextEvent = analysis.events.find((event) => event.id !== eventId);
      setSelectedEventId(nextEvent?.id);
    }
  };

  const handleSaveEvent = (event: FightEvent) => {
    setAnalysis((current) => {
      const exists = current.events.some((currentEvent) => currentEvent.id === event.id);
      const nextEvents = exists
        ? current.events.map((currentEvent) => (currentEvent.id === event.id ? event : currentEvent))
        : [...current.events, event];
      const nextPoseFrame = createPoseFrame(event);
      const poseExists = current.poseFrames.some((pose) => pose.id === event.poseFrameId);
      const nextPoseFrames = poseExists
        ? current.poseFrames.map((pose) => (pose.id === event.poseFrameId ? nextPoseFrame : pose))
        : [...current.poseFrames, nextPoseFrame];

      return updateAnalysisEvents(current, nextEvents, nextPoseFrames);
    });

    setSelectedEventId(event.id);
    setSeekRequest(event.timestamp);
    setEditingEvent(undefined);
    setIsAddingEvent(false);
  };

  const selectedFighter = selectedEvent ? analysis.fighters[selectedEvent.fighterId] : undefined;
  const analysisModeLabel =
    analysis.analysisMode === "client_frame_analysis"
      ? "Client frame analysis"
      : analysis.analysisMode === "linked_metadata_analysis"
        ? "Linked metadata fallback"
        : "Sample dataset";
  const headerMetrics: HeaderMetric[] = [
    { label: "Events", value: analysis.stats.eventCount, Icon: BrainCircuit },
    { label: "Avg confidence", value: `${analysis.stats.averageConfidence}%`, Icon: DatabaseZap },
    { label: "Rounds", value: analysis.rounds.length, Icon: Trophy },
  ];

  return (
    <main className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/70 shadow-2xl shadow-black/30">
          <div className="relative p-6 md:p-8">
            <div className="absolute inset-0 fight-grid opacity-35" />
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="absolute left-1/3 top-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-orange-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-orange-200">
                  <RadioTower className="h-4 w-4" />
                  FightID prototype
                </div>
                <h1 className="max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">
                  MMA footage analysis with interactive timestamped breakdowns.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                  Upload or link fight footage, run a structured video-analysis pipeline, inspect
                  jabs, kicks, takedowns, scrambles, momentum swings, pose silhouettes, and
                  editable fight stats in one polished film-room interface.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {headerMetrics.map(({ label, value, Icon }) => (
                  <div
                    className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 backdrop-blur"
                    key={label}
                  >
                    <Icon className="mb-3 h-5 w-5 text-orange-300" />
                    <p className="text-3xl font-black text-white">{value}</p>
                    <p className="text-sm text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-2xl border border-slate-800 bg-slate-950/75 p-1">
            {(["breakdown", "summary"] as const).map((view) => (
              <button
                className={`rounded-xl px-5 py-3 text-sm font-black uppercase tracking-[0.16em] transition ${
                  activeView === view
                    ? "bg-orange-400 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3 text-sm text-slate-400">
            <span className="font-bold text-white">{analysis.title}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{analysis.venue}</span>
          </div>
        </div>

        {activeView === "summary" ? (
          <SummaryScreen analysis={analysis} />
        ) : (
          <div className="space-y-6">
            <UploadPanel
              analyzedSource={analyzedSource}
              analysisMode={analysisModeLabel}
              analysisSummary={analysis.analysisSummary}
              isAnalysisStale={isAnalysisStale}
              isAnalyzing={isAnalyzing}
              source={source}
              onAnalyze={handleAnalyze}
              onSourceChange={handleSourceChange}
            />
            <PipelineStatus stages={stages} />

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_520px]">
              <div className="space-y-6">
                <VideoStage
                  fighter={selectedFighter}
                  seekRequest={seekRequest}
                  selectedEvent={selectedEvent}
                  selectedPoseFrame={selectedPoseFrame}
                  source={source}
                  onSeekHandled={handleSeekHandled}
                />
                <FighterComparison fighters={analysis.fighters} stats={analysis.stats} />
                <StatsDashboard fighters={analysis.fighters} stats={analysis.stats} />
              </div>

              <aside className="space-y-6">
                <TimelineFilters
                  fighters={analysis.fighters}
                  filters={filters}
                  rounds={analysis.rounds.map((round) => round.number)}
                  onChange={setFilters}
                />
                <EventTimeline
                  events={filteredEvents}
                  fighters={analysis.fighters}
                  poseFrames={analysis.poseFrames}
                  selectedEventId={selectedEvent?.id}
                  onAdd={() => setIsAddingEvent(true)}
                  onDelete={handleDeleteEvent}
                  onEdit={setEditingEvent}
                  onSelect={handleSelectEvent}
                />
              </aside>
            </div>
          </div>
        )}
      </div>

      {(editingEvent || isAddingEvent) && (
        <EventEditor
          event={editingEvent}
          fighters={analysis.fighters}
          maxDuration={analysis.duration}
          onClose={() => {
            setEditingEvent(undefined);
            setIsAddingEvent(false);
          }}
          onSave={handleSaveEvent}
        />
      )}
    </main>
  );
}

export default App;
