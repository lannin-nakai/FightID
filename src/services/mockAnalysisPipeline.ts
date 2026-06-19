import { createPoseFrame, fighters, mockFightAnalysis } from "../data/mockFight";
import type {
  EventImpact,
  EventResult,
  FightAnalysis,
  FightEvent,
  FightRound,
  FighterId,
  MovementType,
  VideoSource,
} from "../types/fight";
import { MOVEMENT_LABELS } from "../types/fight";
import { aggregateFightStats } from "../utils/fightStats";
import { getYouTubeVideoId } from "../utils/videoSource";

export interface PipelineStage {
  id: string;
  label: string;
  description: string;
  status: "queued" | "running" | "complete";
}

export const createPipelineStages = (): PipelineStage[] => [
  {
    id: "ingestion",
    label: "Video ingestion",
    description: "Validate uploaded file or linked video metadata.",
    status: "queued",
  },
  {
    id: "frames",
    label: "Frame extraction",
    description: "Sample fight footage into model-ready frame windows.",
    status: "queued",
  },
  {
    id: "tracking",
    label: "Fighter tracking",
    description: "Separate red/blue fighter tracks and cage position.",
    status: "queued",
  },
  {
    id: "pose",
    label: "Pose estimation",
    description: "Detect keypoints for limbs, torso, head, and stance lines.",
    status: "queued",
  },
  {
    id: "classification",
    label: "Movement classification",
    description: "Classify strikes, grappling exchanges, defense, and footwork.",
    status: "queued",
  },
  {
    id: "events",
    label: "Event detection",
    description: "Merge frame predictions into timestamped fight events.",
    status: "queued",
  },
  {
    id: "stats",
    label: "Stats aggregation",
    description: "Compute fighter totals, round splits, and momentum.",
    status: "queued",
  },
];

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

type FrameSignal = {
  timestamp: number;
  luminance: number;
  motion: number;
  contrast: number;
  warmth: number;
};

const STRIKING_MOVEMENTS: MovementType[] = [
  "jab",
  "cross",
  "hook",
  "uppercut",
  "low_kick",
  "body_kick",
  "head_kick",
  "knee",
  "elbow",
  "counter",
];

const GRAPPLING_MOVEMENTS: MovementType[] = [
  "takedown_attempt",
  "successful_takedown",
  "clinch_exchange",
  "scramble",
];

const hashString = (value: string): number =>
  value.split("").reduce((hash, character) => {
    const nextHash = (hash << 5) - hash + character.charCodeAt(0);
    return nextHash | 0;
  }, 0);

const seededValue = (seed: number, index: number): number => {
  const value = Math.sin(seed + index * 999) * 10000;
  return value - Math.floor(value);
};

const getRoundForTimestamp = (timestamp: number, rounds: FightRound[]): number =>
  rounds.find((round) => timestamp >= round.startsAt && timestamp <= round.endsAt)?.number ??
  rounds[rounds.length - 1]?.number ??
  1;

const buildRounds = (duration: number): FightRound[] => {
  const safeDuration = Math.max(60, Math.floor(duration || 900));
  const roundCount = safeDuration >= 720 ? 3 : safeDuration >= 300 ? 2 : 1;
  const roundLength = safeDuration / roundCount;

  return Array.from({ length: roundCount }, (_, index) => ({
    number: index + 1,
    startsAt: Math.round(index * roundLength),
    endsAt: Math.round((index + 1) * roundLength),
  }));
};

const buildAnalysisTitle = (source: VideoSource, mode: FightAnalysis["analysisMode"]) => {
  if (source.kind === "sample") {
    return mockFightAnalysis.title;
  }

  const prefix =
    mode === "client_frame_analysis"
      ? "Frame analysis"
      : "Linked-source analysis";

  return `${prefix}: ${source.label}`;
};

const buildGenericEvent = (
  source: VideoSource,
  timestamp: number,
  index: number,
  rounds: FightRound[],
  movementType: MovementType,
  result: EventResult,
  impact: EventImpact,
  confidence: number,
  notes: string,
): FightEvent => {
  const seed = Math.abs(hashString(`${source.label}-${source.src ?? ""}`));
  const fighterId: FighterId = seededValue(seed, index) > 0.48 ? "red" : "blue";
  const id = `evt-${source.kind}-${seed.toString(36)}-${index.toString().padStart(2, "0")}`;

  return {
    id,
    fighterId,
    opponentId: fighterId === "red" ? "blue" : "red",
    movementType,
    label: `${MOVEMENT_LABELS[movementType]} candidate`,
    result,
    impact,
    round: getRoundForTimestamp(timestamp, rounds),
    timestamp: Math.round(timestamp),
    durationSec: Math.max(1, Math.round((1.2 + seededValue(seed, index + 20) * 5) * 10) / 10),
    confidence,
    significant: impact === "high" || impact === "critical",
    notes,
    poseFrameId: `pose-${id}`,
  };
};

const loadVideoMetadata = (source: VideoSource): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    if (!source.src) {
      reject(new Error("No video source URL was provided."));
      return;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const timeout = window.setTimeout(() => {
      reject(new Error("Timed out loading video metadata."));
    }, 12000);

    video.addEventListener(
      "loadedmetadata",
      () => {
        window.clearTimeout(timeout);
        resolve(video);
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("The browser could not load this video source."));
      },
      { once: true },
    );
    video.src = source.src;
  });

const seekVideo = (video: HTMLVideoElement, timestamp: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Timed out seeking video frame."));
    }, 8000);

    video.addEventListener(
      "seeked",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    video.currentTime = Math.min(Math.max(0, timestamp), Math.max(0, video.duration - 0.2));
  });

const measureFrame = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  previous?: Uint8ClampedArray,
): Omit<FrameSignal, "timestamp"> & { pixels: Uint8ClampedArray } => {
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  let luminanceTotal = 0;
  let contrastTotal = 0;
  let redTotal = 0;
  let blueTotal = 0;
  let motionTotal = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    luminanceTotal += luminance;
    contrastTotal += Math.abs(luminance - 128);
    redTotal += red;
    blueTotal += blue;

    if (previous) {
      motionTotal +=
        Math.abs(red - (previous[index] ?? 0)) +
        Math.abs(green - (previous[index + 1] ?? 0)) +
        Math.abs(blue - (previous[index + 2] ?? 0));
    }
  }

  const pixelCount = pixels.length / 4;

  return {
    pixels,
    luminance: luminanceTotal / pixelCount / 255,
    contrast: contrastTotal / pixelCount / 128,
    warmth: (redTotal - blueTotal) / pixelCount / 255,
    motion: previous ? motionTotal / pixelCount / 255 / 3 : 0,
  };
};

const sampleVideoFrames = async (
  source: VideoSource,
  onStageChange: (stages: PipelineStage[]) => void,
): Promise<{ duration: number; signals: FrameSignal[] }> => {
  const stages = createPipelineStages();

  onStageChange(
    stages.map((stage, index) => ({
      ...stage,
      status: index === 0 ? "running" : "queued",
    })),
  );
  const video = await loadVideoMetadata(source);
  const duration = Number.isFinite(video.duration) ? video.duration : 900;
  const sampleCount = Math.min(28, Math.max(10, Math.floor(duration / 24)));
  const canvas = document.createElement("canvas");
  const width = 96;
  const height = 54;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas frame analysis is unavailable in this browser.");
  }

  onStageChange(
    stages.map((stage, index) => ({
      ...stage,
      status: index < 1 ? "complete" : index === 1 ? "running" : "queued",
    })),
  );

  const signals: FrameSignal[] = [];
  let previousPixels: Uint8ClampedArray | undefined;

  for (let index = 0; index < sampleCount; index += 1) {
    const timestamp = ((index + 1) / (sampleCount + 1)) * duration;
    await seekVideo(video, timestamp);
    context.drawImage(video, 0, 0, width, height);
    const measurement = measureFrame(context, width, height, previousPixels);
    previousPixels = new Uint8ClampedArray(measurement.pixels);
    signals.push({
      timestamp,
      luminance: measurement.luminance,
      contrast: measurement.contrast,
      motion: measurement.motion,
      warmth: measurement.warmth,
    });

    if (index === Math.floor(sampleCount * 0.3)) {
      onStageChange(
        stages.map((stage, stageIndex) => ({
          ...stage,
          status: stageIndex < 2 ? "complete" : stageIndex === 2 ? "running" : "queued",
        })),
      );
    }

    if (index === Math.floor(sampleCount * 0.65)) {
      onStageChange(
        stages.map((stage, stageIndex) => ({
          ...stage,
          status: stageIndex < 3 ? "complete" : stageIndex === 3 ? "running" : "queued",
        })),
      );
    }
  }

  return { duration, signals };
};

const eventsFromFrameSignals = (
  source: VideoSource,
  duration: number,
  rounds: FightRound[],
  signals: FrameSignal[],
): FightEvent[] => {
  const sortedSignals = [...signals].sort(
    (left, right) =>
      right.motion + right.contrast * 0.25 - (left.motion + left.contrast * 0.25),
  );
  const selectedSignals = sortedSignals.slice(0, Math.min(18, Math.max(8, sortedSignals.length)));
  const seed = Math.abs(hashString(`${source.label}-${source.src ?? ""}`));

  return selectedSignals
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((signal, index) => {
      const intensity = Math.min(1, signal.motion * 2.2 + signal.contrast * 0.35);
      const movementBucket =
        intensity > 0.72
          ? STRIKING_MOVEMENTS
          : signal.motion < 0.12
            ? (["footwork_pattern", "feint", "defensive_movement"] satisfies MovementType[])
            : GRAPPLING_MOVEMENTS;
      const movementType =
        movementBucket[Math.floor(seededValue(seed, index + Math.round(signal.timestamp)) * movementBucket.length)] ??
        "footwork_pattern";
      const result: EventResult =
        intensity > 0.78
          ? "landed"
          : movementType === "defensive_movement"
            ? "defended"
            : movementType === "successful_takedown"
              ? "successful"
              : intensity > 0.45
                ? "transition"
                : "created_space";
      const impact: EventImpact =
        intensity > 0.88 ? "critical" : intensity > 0.68 ? "high" : intensity > 0.38 ? "medium" : "low";
      const confidence = Math.min(0.88, Math.max(0.46, 0.44 + intensity * 0.38));

      return buildGenericEvent(
        source,
        Math.min(duration - 1, signal.timestamp),
        index,
        rounds,
        movementType,
        result,
        impact,
        Math.round(confidence * 100) / 100,
        `Client-side frame analysis detected motion=${signal.motion.toFixed(
          2,
        )}, contrast=${signal.contrast.toFixed(2)}, luminance=${signal.luminance.toFixed(
          2,
        )}. Movement label is a heuristic candidate until a trained MMA model is connected.`,
      );
    });
};

const buildSourceSpecificLinkedEvents = (
  source: VideoSource,
  duration: number,
  rounds: FightRound[],
): FightEvent[] => {
  const seed = Math.abs(hashString(`${source.label}-${source.src ?? ""}`));
  const eventCount = 12 + Math.floor(seededValue(seed, 1) * 10);
  const movementPool: MovementType[] = [
    ...STRIKING_MOVEMENTS,
    ...GRAPPLING_MOVEMENTS,
    "feint",
    "defensive_movement",
    "footwork_pattern",
    "momentum_shift",
  ];

  return Array.from({ length: eventCount }, (_, index) => {
    const timestamp = Math.max(
      4,
      Math.min(duration - 2, ((index + 1) / (eventCount + 1)) * duration + seededValue(seed, index) * 18 - 9),
    );
    const movementType =
      movementPool[Math.floor(seededValue(seed, index + 10) * movementPool.length)] ?? "footwork_pattern";
    const impact: EventImpact =
      seededValue(seed, index + 40) > 0.9
        ? "critical"
        : seededValue(seed, index + 41) > 0.66
          ? "high"
          : seededValue(seed, index + 42) > 0.35
            ? "medium"
            : "low";
    const result: EventResult =
      movementType === "takedown_attempt"
        ? "stuffed"
        : movementType === "successful_takedown"
          ? "successful"
          : movementType === "momentum_shift"
            ? "momentum_shift"
            : impact === "low"
              ? "created_space"
              : "landed";

    return buildGenericEvent(
      source,
      timestamp,
      index,
      rounds,
      movementType,
      result,
      impact,
      Math.round((0.32 + seededValue(seed, index + 90) * 0.28) * 100) / 100,
      "External linked video frames are not readable by this browser session, so this timestamp is source-specific metadata scaffolding rather than visual fight recognition.",
    );
  }).sort((left, right) => left.timestamp - right.timestamp);
};

const finalizeAnalysis = (
  source: VideoSource,
  mode: FightAnalysis["analysisMode"],
  duration: number,
  rounds: FightRound[],
  events: FightEvent[],
  summary: string,
): FightAnalysis => {
  const poseFrames = events.map(createPoseFrame);

  return {
    ...mockFightAnalysis,
    id: `fightid-${mode}-${Math.abs(hashString(`${source.label}-${source.src ?? ""}`)).toString(36)}`,
    title: buildAnalysisTitle(source, mode),
    venue:
      mode === "client_frame_analysis"
        ? "Client-side frame analyzer"
        : "Linked-video metadata analyzer",
    date: new Date().toISOString().slice(0, 10),
    duration: Math.round(duration),
    sourceLabel: source.label,
    sourceKind: source.kind,
    analysisMode: mode,
    analysisSummary: summary,
    fighters: {
      red: { ...fighters.red, name: "Red tracked fighter", record: "source-derived", reach: "unknown" },
      blue: { ...fighters.blue, name: "Blue tracked fighter", record: "source-derived", reach: "unknown" },
    },
    rounds,
    events,
    poseFrames,
    stats: aggregateFightStats(events, rounds),
  };
};

export const runFightAnalysis = async (
  source: VideoSource,
  onStageChange: (stages: PipelineStage[]) => void,
): Promise<FightAnalysis> => {
  const stages = createPipelineStages();

  if (source.kind === "sample") {
    for (let index = 0; index < stages.length; index += 1) {
      const runningStages = stages.map((stage, stageIndex) => ({
        ...stage,
        status:
          stageIndex < index ? "complete" : stageIndex === index ? "running" : "queued",
      })) satisfies PipelineStage[];

      onStageChange(runningStages);
      await wait(180);
    }

    onStageChange(stages.map((stage) => ({ ...stage, status: "complete" })));
    return mockFightAnalysis;
  }

  const isYouTube = Boolean(source.src && getYouTubeVideoId(source.src));

  if (!isYouTube && source.src) {
    try {
      const { duration, signals } = await sampleVideoFrames(source, onStageChange);
      const rounds = buildRounds(duration);

      onStageChange(
        stages.map((stage, index) => ({
          ...stage,
          status: index < 4 ? "complete" : index === 4 ? "running" : "queued",
        })),
      );
      const events = eventsFromFrameSignals(source, duration, rounds, signals);

      onStageChange(
        stages.map((stage, index) => ({
          ...stage,
          status: index < 5 ? "complete" : index === 5 ? "running" : "queued",
        })),
      );
      await wait(160);
      onStageChange(stages.map((stage) => ({ ...stage, status: "complete" })));

      return finalizeAnalysis(
        source,
        "client_frame_analysis",
        duration,
        rounds,
        events,
        "Actual client-side video analysis ran: the browser sampled frames from the selected source, measured motion, luminance, contrast, and color balance, then generated heuristic timestamp candidates. This is not yet a trained MMA technique classifier.",
      );
    } catch (error) {
      console.warn("Falling back to linked metadata analysis:", error);
    }
  }

  for (let index = 0; index < stages.length; index += 1) {
    const runningStages = stages.map((stage, stageIndex) => ({
      ...stage,
      status:
        stageIndex < index ? "complete" : stageIndex === index ? "running" : "queued",
    })) satisfies PipelineStage[];

    onStageChange(runningStages);
    await wait(320);
  }

  onStageChange(stages.map((stage) => ({ ...stage, status: "complete" })));

  const duration = 900;
  const rounds = buildRounds(duration);
  const events = buildSourceSpecificLinkedEvents(source, duration, rounds);

  /*
   * Backend integration point for external providers:
   * YouTube and many hosted links cannot be frame-sampled in the browser because
   * iframe players and cross-origin videos do not expose pixels to canvas. A
   * production system should send the URL to a backend worker that downloads or
   * transcodes the footage, runs pose estimation and action classifiers, and
   * returns this same FightAnalysis shape.
   */
  return finalizeAnalysis(
    source,
    "linked_metadata_analysis",
    duration,
    rounds,
    events,
    isYouTube
      ? "YouTube embeds are playable, but browser security prevents reading their frames directly. The app generated source-specific scaffolding from the link so the dashboard changes, but true visual analysis needs a backend video ingestion worker."
      : "The browser could not read frames from this linked source, likely because of CORS or media access restrictions. The app generated source-specific scaffolding from the link; use file upload or a CORS-enabled direct video URL for client-side frame analysis.",
  );
};

export const runMockFightAnalysis = runFightAnalysis;
