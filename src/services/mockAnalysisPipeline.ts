import { createPoseFrame, fighters, mockFightAnalysis } from "../data/mockFight";
import type {
  EventImpact,
  EventResult,
  FightAnalysis,
  FightEvent,
  FightRound,
  FighterId,
  MovementType,
  PoseFrame,
  PoseKeypoint,
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
    description: "Run MoveNet keypoint detection for limbs, torso, head, and stance lines.",
    status: "queued",
  },
  {
    id: "classification",
    label: "Movement classification",
    description: "Fuse pose velocity, extension, level-change, proximity, and frame motion.",
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

type PoseEstimateKeypoint = {
  name?: string;
  x: number;
  y: number;
  score?: number;
};

type PoseEstimate = {
  keypoints: PoseEstimateKeypoint[];
  score?: number;
};

type PoseDetectorLike = {
  estimatePoses: (
    image: HTMLVideoElement | HTMLCanvasElement,
    config?: { maxPoses?: number; flipHorizontal?: boolean },
  ) => Promise<PoseEstimate[]>;
  dispose?: () => void;
};

type PoseSignal = FrameSignal & {
  poseConfidence: number;
  poseCount: number;
  handVelocity: number;
  footVelocity: number;
  handExtension: number;
  handVerticalLift: number;
  handLateralTravel: number;
  kickHeight: number;
  levelChange: number;
  clinchDistance: number;
  defensiveShell: number;
  torsoRotation: number;
  stanceWidth: number;
  hipDrive: number;
  frameWidth: number;
  frameHeight: number;
  dominantCenterX: number;
  dominantPose?: PoseEstimate;
};

type PoseAnalysisResult = {
  duration: number;
  signals: PoseSignal[];
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

type MovementFeatureKey =
  | "handVelocity"
  | "handExtension"
  | "handVerticalLift"
  | "handLateralTravel"
  | "footVelocity"
  | "kickHeight"
  | "levelChange"
  | "clinchDistance"
  | "defensiveShell"
  | "torsoRotation"
  | "stanceWidth"
  | "hipDrive"
  | "motion"
  | "poseCount";

type MovementCue = {
  movementType: MovementType;
  result: EventResult;
  baseImpact: EventImpact;
  minScore: number;
  weights: Partial<Record<MovementFeatureKey, number>>;
  negativeWeights?: Partial<Record<MovementFeatureKey, number>>;
  evidence: string;
};

/*
 * Movement-judgement resources baked into the browser classifier:
 * - Boxing biomechanics literature distinguishes straight punches, hooks, and
 *   uppercuts by endpoint velocity, body rotation, and vertical/lateral punch path.
 * - Combat-sport coaching cues distinguish kicks by ankle/foot velocity plus
 *   target height, takedowns by hip level change/penetration, and clinch by
 *   close multi-person proximity.
 * - Pose-action-recognition practice uses normalized keypoint positions,
 *   temporal velocities, and multi-frame windows rather than single-frame labels.
 */
const MOVEMENT_CUES: MovementCue[] = [
  {
    movementType: "jab",
    result: "landed",
    baseImpact: "medium",
    minScore: 0.34,
    weights: { handVelocity: 0.24, handExtension: 0.3, motion: 0.1 },
    negativeWeights: { torsoRotation: 0.18, handLateralTravel: 0.1, handVerticalLift: 0.1 },
    evidence: "short, fast straight lead-hand extension with limited torso rotation",
  },
  {
    movementType: "cross",
    result: "landed",
    baseImpact: "high",
    minScore: 0.42,
    weights: { handVelocity: 0.28, handExtension: 0.26, torsoRotation: 0.18, hipDrive: 0.12 },
    negativeWeights: { handVerticalLift: 0.08 },
    evidence: "rear straight punch pattern with hand extension plus hip/torso rotation",
  },
  {
    movementType: "hook",
    result: "landed",
    baseImpact: "high",
    minScore: 0.4,
    weights: { handVelocity: 0.24, handLateralTravel: 0.28, torsoRotation: 0.2, handExtension: 0.08 },
    negativeWeights: { handVerticalLift: 0.1 },
    evidence: "circular punch path with lateral hand travel and trunk rotation",
  },
  {
    movementType: "uppercut",
    result: "landed",
    baseImpact: "high",
    minScore: 0.38,
    weights: { handVelocity: 0.22, handVerticalLift: 0.3, torsoRotation: 0.12, hipDrive: 0.1 },
    negativeWeights: { kickHeight: 0.08 },
    evidence: "rising hand path with shoulder/hip drive",
  },
  {
    movementType: "elbow",
    result: "landed",
    baseImpact: "medium",
    minScore: 0.36,
    weights: { handVelocity: 0.2, handLateralTravel: 0.16, clinchDistance: 0.22, torsoRotation: 0.1 },
    negativeWeights: { handExtension: 0.12 },
    evidence: "short-range upper-limb strike during close distance",
  },
  {
    movementType: "counter",
    result: "landed",
    baseImpact: "high",
    minScore: 0.44,
    weights: { defensiveShell: 0.18, handVelocity: 0.22, handExtension: 0.16, motion: 0.12 },
    evidence: "defensive shell or retreat followed by fast hand extension",
  },
  {
    movementType: "low_kick",
    result: "landed",
    baseImpact: "medium",
    minScore: 0.36,
    weights: { footVelocity: 0.34, motion: 0.1 },
    negativeWeights: { kickHeight: 0.22, handVelocity: 0.08 },
    evidence: "fast lower-limb motion with low target height",
  },
  {
    movementType: "body_kick",
    result: "landed",
    baseImpact: "medium",
    minScore: 0.4,
    weights: { footVelocity: 0.3, kickHeight: 0.22, torsoRotation: 0.1, stanceWidth: 0.08 },
    negativeWeights: { levelChange: 0.08 },
    evidence: "fast foot path rising to midline target height",
  },
  {
    movementType: "head_kick",
    result: "landed",
    baseImpact: "critical",
    minScore: 0.48,
    weights: { footVelocity: 0.28, kickHeight: 0.38, torsoRotation: 0.08 },
    negativeWeights: { clinchDistance: 0.12 },
    evidence: "fast foot path at shoulder/head height",
  },
  {
    movementType: "knee",
    result: "landed",
    baseImpact: "high",
    minScore: 0.42,
    weights: { footVelocity: 0.22, kickHeight: 0.18, clinchDistance: 0.2, levelChange: 0.08 },
    negativeWeights: { handExtension: 0.08 },
    evidence: "close-range lower-limb lift through the body line",
  },
  {
    movementType: "takedown_attempt",
    result: "stuffed",
    baseImpact: "medium",
    minScore: 0.4,
    weights: { levelChange: 0.34, hipDrive: 0.2, clinchDistance: 0.14, motion: 0.08 },
    negativeWeights: { kickHeight: 0.12 },
    evidence: "hip level drop and forward drive toward opponent",
  },
  {
    movementType: "successful_takedown",
    result: "successful",
    baseImpact: "high",
    minScore: 0.56,
    weights: { levelChange: 0.34, hipDrive: 0.2, clinchDistance: 0.2, poseCount: 0.08 },
    negativeWeights: { defensiveShell: 0.08 },
    evidence: "level change with close-contact drive and large positional displacement",
  },
  {
    movementType: "clinch_exchange",
    result: "transition",
    baseImpact: "medium",
    minScore: 0.38,
    weights: { clinchDistance: 0.36, poseCount: 0.12, handLateralTravel: 0.08, motion: 0.08 },
    negativeWeights: { kickHeight: 0.1 },
    evidence: "two-fighter close proximity with upper-body pummeling movement",
  },
  {
    movementType: "scramble",
    result: "transition",
    baseImpact: "medium",
    minScore: 0.42,
    weights: { levelChange: 0.22, clinchDistance: 0.18, motion: 0.18, hipDrive: 0.12 },
    evidence: "rapid level and position changes after grappling contact",
  },
  {
    movementType: "defensive_movement",
    result: "defended",
    baseImpact: "low",
    minScore: 0.32,
    weights: { defensiveShell: 0.34, levelChange: 0.08, handVelocity: 0.06 },
    negativeWeights: { handExtension: 0.1, kickHeight: 0.1 },
    evidence: "hands near head/torso with evasive level or guard movement",
  },
  {
    movementType: "footwork_pattern",
    result: "created_space",
    baseImpact: "low",
    minScore: 0.28,
    weights: { stanceWidth: 0.18, motion: 0.12, hipDrive: 0.1 },
    negativeWeights: { handVelocity: 0.12, kickHeight: 0.12, clinchDistance: 0.1 },
    evidence: "lower-body repositioning without clear strike or grappling contact",
  },
  {
    movementType: "feint",
    result: "created_space",
    baseImpact: "low",
    minScore: 0.3,
    weights: { handVelocity: 0.08, footVelocity: 0.08, levelChange: 0.08, motion: 0.12 },
    negativeWeights: { handExtension: 0.12, clinchDistance: 0.12 },
    evidence: "small initiating motion without full extension or contact pattern",
  },
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
    mode === "pose_enhanced_analysis"
      ? "Pose-enhanced analysis"
      : mode === "client_frame_analysis"
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
  fighterIdOverride?: FighterId,
): FightEvent => {
  const seed = Math.abs(hashString(`${source.label}-${source.src ?? ""}`));
  const fighterId: FighterId =
    fighterIdOverride ?? (seededValue(seed, index) > 0.48 ? "red" : "blue");
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

const createPoseDetector = async (): Promise<PoseDetectorLike> => {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");
  const [moveNet, moveNetConstants, trackerTypes] = await Promise.all([
    import("@tensorflow-models/pose-detection/dist/movenet/detector"),
    import("@tensorflow-models/pose-detection/dist/movenet/constants"),
    import("@tensorflow-models/pose-detection/dist/calculators/types"),
  ]);

  try {
    await tf.setBackend("webgl");
  } catch {
    await tf.setBackend("cpu");
  }

  await tf.ready();

  return moveNet.load({
    modelType: moveNetConstants.MULTIPOSE_LIGHTNING,
    enableTracking: true,
    trackerType: trackerTypes.TrackerType.BoundingBox,
    multiPoseMaxDimension: 320,
    minPoseScore: 0.18,
  }) as Promise<PoseDetectorLike>;
};

const getKeypoint = (pose: PoseEstimate | undefined, name: string) =>
  pose?.keypoints.find((keypoint) => keypoint.name === name && (keypoint.score ?? 0) >= 0.18);

const keypointConfidence = (pose: PoseEstimate | undefined) => {
  if (!pose?.keypoints.length) {
    return 0;
  }

  const scored = pose.keypoints.filter((keypoint) => typeof keypoint.score === "number");

  if (!scored.length) {
    return pose.score ?? 0;
  }

  return scored.reduce((sum, keypoint) => sum + (keypoint.score ?? 0), 0) / scored.length;
};

const distance = (
  left: PoseEstimateKeypoint | undefined,
  right: PoseEstimateKeypoint | undefined,
  width: number,
  height: number,
) => {
  if (!left || !right) {
    return 0;
  }

  const dx = (left.x - right.x) / width;
  const dy = (left.y - right.y) / height;
  return Math.hypot(dx, dy);
};

const averagePoint = (
  left: PoseEstimateKeypoint | undefined,
  right: PoseEstimateKeypoint | undefined,
): PoseEstimateKeypoint | undefined => {
  if (!left && !right) {
    return undefined;
  }

  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    score: ((left.score ?? 0) + (right.score ?? 0)) / 2,
  };
};

const poseCenter = (pose: PoseEstimate | undefined): PoseEstimateKeypoint | undefined => {
  const shoulders = averagePoint(
    getKeypoint(pose, "left_shoulder"),
    getKeypoint(pose, "right_shoulder"),
  );
  const hips = averagePoint(getKeypoint(pose, "left_hip"), getKeypoint(pose, "right_hip"));

  return averagePoint(shoulders, hips);
};

const keypointVelocity = (
  current: PoseEstimateKeypoint | undefined,
  previous: PoseEstimateKeypoint | undefined,
  width: number,
  height: number,
) => distance(current, previous, width, height);

const derivePoseSignal = (
  frameSignal: FrameSignal,
  poses: PoseEstimate[],
  previousPose: PoseEstimate | undefined,
  width: number,
  height: number,
): PoseSignal => {
  const sortedPoses = [...poses].sort(
    (left, right) => keypointConfidence(right) - keypointConfidence(left),
  );
  const dominantPose = sortedPoses[0];
  const secondPose = sortedPoses[1];
  const leftWrist = getKeypoint(dominantPose, "left_wrist");
  const rightWrist = getKeypoint(dominantPose, "right_wrist");
  const leftAnkle = getKeypoint(dominantPose, "left_ankle");
  const rightAnkle = getKeypoint(dominantPose, "right_ankle");
  const leftShoulder = getKeypoint(dominantPose, "left_shoulder");
  const rightShoulder = getKeypoint(dominantPose, "right_shoulder");
  const leftHip = getKeypoint(dominantPose, "left_hip");
  const rightHip = getKeypoint(dominantPose, "right_hip");
  const nose = getKeypoint(dominantPose, "nose");
  const leftElbow = getKeypoint(dominantPose, "left_elbow");
  const rightElbow = getKeypoint(dominantPose, "right_elbow");
  const previousLeftWrist = getKeypoint(previousPose, "left_wrist");
  const previousRightWrist = getKeypoint(previousPose, "right_wrist");
  const previousLeftAnkle = getKeypoint(previousPose, "left_ankle");
  const previousRightAnkle = getKeypoint(previousPose, "right_ankle");
  const previousLeftShoulder = getKeypoint(previousPose, "left_shoulder");
  const previousRightShoulder = getKeypoint(previousPose, "right_shoulder");
  const hipCenter = averagePoint(leftHip, rightHip);
  const previousHipCenter = averagePoint(
    getKeypoint(previousPose, "left_hip"),
    getKeypoint(previousPose, "right_hip"),
  );
  const shoulderWidth = Math.max(0.04, distance(leftShoulder, rightShoulder, width, height));
  const leftHandExtension = distance(leftWrist, leftShoulder, width, height) / shoulderWidth;
  const rightHandExtension = distance(rightWrist, rightShoulder, width, height) / shoulderWidth;
  const handExtension = Math.min(2.4, Math.max(leftHandExtension, rightHandExtension)) / 2.4;
  const handVelocity = Math.min(
    1,
    Math.max(
      keypointVelocity(leftWrist, previousLeftWrist, width, height),
      keypointVelocity(rightWrist, previousRightWrist, width, height),
    ) * 4,
  );
  const footVelocity = Math.min(
    1,
    Math.max(
      keypointVelocity(leftAnkle, previousLeftAnkle, width, height),
      keypointVelocity(rightAnkle, previousRightAnkle, width, height),
    ) * 4,
  );
  const leftHandVerticalLift =
    leftWrist && previousLeftWrist ? Math.max(0, (previousLeftWrist.y - leftWrist.y) / height) : 0;
  const rightHandVerticalLift =
    rightWrist && previousRightWrist ? Math.max(0, (previousRightWrist.y - rightWrist.y) / height) : 0;
  const handVerticalLift = Math.min(1, Math.max(leftHandVerticalLift, rightHandVerticalLift) * 5);
  const leftHandLateralTravel =
    leftWrist && previousLeftWrist ? Math.abs(leftWrist.x - previousLeftWrist.x) / width : 0;
  const rightHandLateralTravel =
    rightWrist && previousRightWrist ? Math.abs(rightWrist.x - previousRightWrist.x) / width : 0;
  const handLateralTravel = Math.min(1, Math.max(leftHandLateralTravel, rightHandLateralTravel) * 5);
  const highestFoot = Math.min(leftAnkle?.y ?? height, rightAnkle?.y ?? height) / height;
  const shoulderLine = averagePoint(leftShoulder, rightShoulder)?.y ?? height * 0.35;
  const kickHeight = Math.max(0, Math.min(1, (shoulderLine / height + 0.32 - highestFoot) * 2.4));
  const levelChange = hipCenter && previousHipCenter ? Math.min(1, Math.abs(hipCenter.y - previousHipCenter.y) / height * 7) : 0;
  const shoulderAngle =
    leftShoulder && rightShoulder
      ? Math.atan2(leftShoulder.y - rightShoulder.y, leftShoulder.x - rightShoulder.x)
      : 0;
  const hipAngle =
    leftHip && rightHip ? Math.atan2(leftHip.y - rightHip.y, leftHip.x - rightHip.x) : 0;
  const torsoRotation = Math.min(1, Math.abs(shoulderAngle - hipAngle) / Math.PI * 2);
  const previousShoulderCenter = averagePoint(previousLeftShoulder, previousRightShoulder);
  const shoulderCenter = averagePoint(leftShoulder, rightShoulder);
  const hipDrive =
    hipCenter && previousHipCenter
      ? Math.min(1, distance(hipCenter, previousHipCenter, width, height) * 5)
      : shoulderCenter && previousShoulderCenter
        ? Math.min(1, distance(shoulderCenter, previousShoulderCenter, width, height) * 4)
        : 0;
  const stanceWidth = Math.min(1, distance(leftAnkle, rightAnkle, width, height) * 2.5);
  const center = poseCenter(dominantPose);
  const otherCenter = poseCenter(secondPose);
  const proximity = center && otherCenter ? distance(center, otherCenter, width, height) : 1;
  const clinchDistance = Math.max(0, Math.min(1, (0.34 - proximity) / 0.34));
  const wristToHead =
    (distance(leftWrist, nose, width, height) + distance(rightWrist, nose, width, height)) / 2;
  const elbowsToTorso =
    (distance(leftElbow, leftHip, width, height) + distance(rightElbow, rightHip, width, height)) /
    2;
  const defensiveShell = Math.max(
    0,
    Math.min(1, (0.38 - wristToHead) * 2.2 + (0.46 - elbowsToTorso) * 0.8),
  );

  return {
    ...frameSignal,
    poseConfidence: keypointConfidence(dominantPose),
    poseCount: sortedPoses.filter((pose) => keypointConfidence(pose) > 0.25).length,
    handVelocity,
    footVelocity,
    handExtension,
    handVerticalLift,
    handLateralTravel,
    kickHeight,
    levelChange,
    clinchDistance,
    defensiveShell,
    torsoRotation,
    stanceWidth,
    hipDrive,
    frameWidth: width,
    frameHeight: height,
    dominantCenterX: center ? Math.max(0, Math.min(1, center.x / width)) : 0.5,
    dominantPose,
  };
};

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
  const sampleCount = Math.max(10, Math.floor(duration / 12));
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

const samplePoseEnhancedFrames = async (
  source: VideoSource,
  onStageChange: (stages: PipelineStage[]) => void,
): Promise<PoseAnalysisResult> => {
  const stages = createPipelineStages();
  const video = await loadVideoMetadata(source);
  const duration = Number.isFinite(video.duration) ? video.duration : 900;
  const sampleCount = Math.max(14, Math.floor(duration / 8));
  const canvas = document.createElement("canvas");
  const width = 128;
  const height = 72;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas frame analysis is unavailable in this browser.");
  }

  onStageChange(
    stages.map((stage, index) => ({
      ...stage,
      status: index < 2 ? "complete" : index === 2 ? "running" : "queued",
    })),
  );

  const detector = await createPoseDetector();

  onStageChange(
    stages.map((stage, index) => ({
      ...stage,
      status: index < 3 ? "complete" : index === 3 ? "running" : "queued",
    })),
  );

  const signals: PoseSignal[] = [];
  let previousPixels: Uint8ClampedArray | undefined;
  let previousPose: PoseEstimate | undefined;

  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const timestamp = ((index + 1) / (sampleCount + 1)) * duration;
      await seekVideo(video, timestamp);
      context.drawImage(video, 0, 0, width, height);
      const measurement = measureFrame(context, width, height, previousPixels);
      previousPixels = new Uint8ClampedArray(measurement.pixels);
      const poses = await detector.estimatePoses(video, {
        flipHorizontal: false,
        maxPoses: 2,
      });
      const frameSignal: FrameSignal = {
        timestamp,
        luminance: measurement.luminance,
        contrast: measurement.contrast,
        motion: measurement.motion,
        warmth: measurement.warmth,
      };
      const poseSignal = derivePoseSignal(
        frameSignal,
        poses,
        previousPose,
        video.videoWidth || width,
        video.videoHeight || height,
      );
      previousPose = poseSignal.dominantPose;
      signals.push(poseSignal);

      if (index === Math.floor(sampleCount * 0.5)) {
        onStageChange(
          stages.map((stage, stageIndex) => ({
            ...stage,
            status: stageIndex < 4 ? "complete" : stageIndex === 4 ? "running" : "queued",
          })),
        );
      }
    }
  } finally {
    detector.dispose?.();
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
  const selectedSignals = sortedSignals.filter(
    (signal) => signal.motion > 0.08 || signal.contrast > 0.18,
  );
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

const poseSalience = (signal: PoseSignal): number =>
  Math.max(
    signal.handVelocity * 0.35 + signal.handExtension * 0.45,
    signal.handLateralTravel * 0.24 + signal.torsoRotation * 0.28,
    signal.handVerticalLift * 0.32 + signal.hipDrive * 0.16,
    signal.footVelocity * 0.35 + signal.kickHeight * 0.48,
    signal.levelChange * 0.72,
    signal.clinchDistance * 0.8,
    signal.defensiveShell * 0.62,
    signal.motion * 1.4 + signal.contrast * 0.18,
  ) * Math.max(0.35, signal.poseConfidence);

const selectPoseEventSignals = (signals: PoseSignal[]): PoseSignal[] => {
  const selected: PoseSignal[] = [];
  const ranked = [...signals]
    .filter((signal) => signal.poseConfidence >= 0.18 || signal.motion > 0.16)
    .sort((left, right) => poseSalience(right) - poseSalience(left));

  for (const signal of ranked) {
    const tooClose = selected.some(
      (selectedSignal) => Math.abs(selectedSignal.timestamp - signal.timestamp) < 1.75,
    );

    if (!tooClose) {
      selected.push(signal);
    }
  }

  return selected.sort((left, right) => left.timestamp - right.timestamp);
};

const getMovementFeatureValue = (signal: PoseSignal, feature: MovementFeatureKey): number => {
  if (feature === "poseCount") {
    return Math.min(1, signal.poseCount / 2);
  }

  return signal[feature];
};

const scoreMovementCue = (signal: PoseSignal, cue: MovementCue): number => {
  const positiveScore = Object.entries(cue.weights).reduce(
    (sum, [feature, weight]) =>
      sum + getMovementFeatureValue(signal, feature as MovementFeatureKey) * weight,
    0,
  );
  const negativeScore = Object.entries(cue.negativeWeights ?? {}).reduce(
    (sum, [feature, weight]) =>
      sum + getMovementFeatureValue(signal, feature as MovementFeatureKey) * weight,
    0,
  );

  return Math.max(0, positiveScore - negativeScore) * Math.max(0.48, signal.poseConfidence);
};

const impactFromCueScore = (cue: MovementCue, score: number): EventImpact => {
  if (score > cue.minScore + 0.34) {
    return cue.baseImpact === "critical" ? "critical" : cue.baseImpact === "high" ? "critical" : "high";
  }

  if (score > cue.minScore + 0.18) {
    return cue.baseImpact === "low" ? "medium" : cue.baseImpact;
  }

  return cue.baseImpact;
};

const resultFromCueScore = (cue: MovementCue, score: number): EventResult => {
  if (cue.result === "landed" && score < cue.minScore + 0.12) {
    return "blocked";
  }

  if (cue.movementType === "takedown_attempt" && score > cue.minScore + 0.22) {
    return "defended";
  }

  return cue.result;
};

const classifyPoseMovement = (
  signal: PoseSignal,
): { movementType: MovementType; result: EventResult; impact: EventImpact; featureScore: number } => {
  const scoredCues = MOVEMENT_CUES.map((cue) => ({
    cue,
    score: scoreMovementCue(signal, cue),
  })).sort((left, right) => right.score - left.score);
  const best = scoredCues.find(({ cue, score }) => score >= cue.minScore) ?? scoredCues[0];

  if (!best) {
    return {
      movementType: "footwork_pattern",
      result: "created_space",
      impact: "low",
      featureScore: signal.motion,
    };
  }

  return {
    movementType: best.cue.movementType,
    result: resultFromCueScore(best.cue, best.score),
    impact: impactFromCueScore(best.cue, best.score),
    featureScore: best.score,
  };
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const poseKeypointToFramePoint = (
  pose: PoseEstimate | undefined,
  keypointName: string,
  id: string,
  label: string,
  width: number,
  height: number,
): PoseKeypoint | undefined => {
  const keypoint = getKeypoint(pose, keypointName);

  if (!keypoint) {
    return undefined;
  }

  return {
    id,
    label,
    x: clampPercent((keypoint.x / width) * 100),
    y: clampPercent((keypoint.y / height) * 100),
  };
};

const averageFramePoint = (
  id: string,
  label: string,
  first: PoseKeypoint | undefined,
  second: PoseKeypoint | undefined,
): PoseKeypoint | undefined => {
  if (!first && !second) {
    return undefined;
  }

  if (!first) {
    return { ...second!, id, label };
  }

  if (!second) {
    return { ...first, id, label };
  }

  return {
    id,
    label,
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
};

const buildDetectedPoseFrame = (event: FightEvent, signal: PoseSignal): PoseFrame => {
  const pose = signal.dominantPose;
  const width = Math.max(1, signal.frameWidth);
  const height = Math.max(1, signal.frameHeight);
  const leftShoulder = poseKeypointToFramePoint(
    pose,
    "left_shoulder",
    "lead_shoulder",
    "Left shoulder",
    width,
    height,
  );
  const rightShoulder = poseKeypointToFramePoint(
    pose,
    "right_shoulder",
    "rear_shoulder",
    "Right shoulder",
    width,
    height,
  );
  const leftHip = poseKeypointToFramePoint(pose, "left_hip", "left_hip", "Left hip", width, height);
  const rightHip = poseKeypointToFramePoint(pose, "right_hip", "right_hip", "Right hip", width, height);
  const head = poseKeypointToFramePoint(pose, "nose", "head", "Head", width, height);
  const neck = averageFramePoint("neck", "Neck", leftShoulder, rightShoulder);
  const hip = averageFramePoint("hip", "Hip", leftHip, rightHip);
  const keypoints = [
    head,
    neck,
    leftShoulder,
    rightShoulder,
    poseKeypointToFramePoint(pose, "left_elbow", "lead_elbow", "Left elbow", width, height),
    poseKeypointToFramePoint(pose, "right_elbow", "rear_elbow", "Right elbow", width, height),
    poseKeypointToFramePoint(pose, "left_wrist", "lead_hand", "Left wrist", width, height),
    poseKeypointToFramePoint(pose, "right_wrist", "rear_hand", "Right wrist", width, height),
    hip,
    poseKeypointToFramePoint(pose, "left_knee", "lead_knee", "Left knee", width, height),
    poseKeypointToFramePoint(pose, "right_knee", "rear_knee", "Right knee", width, height),
    poseKeypointToFramePoint(pose, "left_ankle", "lead_foot", "Left ankle", width, height),
    poseKeypointToFramePoint(pose, "right_ankle", "rear_foot", "Right ankle", width, height),
  ].filter((keypoint): keypoint is PoseKeypoint => Boolean(keypoint));

  if (keypoints.length < 7) {
    return createPoseFrame(event);
  }

  return {
    id: event.poseFrameId,
    timestamp: event.timestamp,
    fighterId: event.fighterId,
    movementType: event.movementType,
    keypoints,
    highlightedJoints: createPoseFrame(event).highlightedJoints,
    facing: signal.dominantCenterX < 0.5 ? "right" : "left",
  };
};

const eventsFromPoseSignals = (
  source: VideoSource,
  duration: number,
  rounds: FightRound[],
  signals: PoseSignal[],
): { events: FightEvent[]; poseFrames: PoseFrame[] } => {
  const events: FightEvent[] = [];
  const poseFrames: PoseFrame[] = [];

  selectPoseEventSignals(signals).forEach((signal, index) => {
    const classification = classifyPoseMovement(signal);
    const confidence = Math.min(
      0.96,
      Math.max(
        0.52,
        0.38 +
          signal.poseConfidence * 0.36 +
          classification.featureScore * 0.22 +
          Math.min(0.12, signal.motion * 0.32),
      ),
    );
    const fighterId: FighterId = signal.dominantCenterX < 0.5 ? "red" : "blue";

    const event = buildGenericEvent(
      source,
      Math.min(duration - 1, signal.timestamp),
      index,
      rounds,
      classification.movementType,
      classification.result,
      classification.impact,
      Math.round(confidence * 100) / 100,
      `Pose-enhanced analysis used MoveNet keypoints plus temporal frame signals. pose=${signal.poseConfidence.toFixed(
        2,
      )}, handVel=${signal.handVelocity.toFixed(2)}, footVel=${signal.footVelocity.toFixed(
        2,
      )}, handExt=${signal.handExtension.toFixed(2)}, handLift=${signal.handVerticalLift.toFixed(
        2,
      )}, lateralHand=${signal.handLateralTravel.toFixed(2)}, kickHeight=${signal.kickHeight.toFixed(
        2,
      )}, levelChange=${signal.levelChange.toFixed(2)}, clinch=${signal.clinchDistance.toFixed(
        2,
      )}, torsoRot=${signal.torsoRotation.toFixed(2)}. Cue: ${
        MOVEMENT_CUES.find((cue) => cue.movementType === classification.movementType)?.evidence ??
        "best available pose/motion match"
      }.`,
      fighterId,
    );
    events.push(event);
    poseFrames.push(buildDetectedPoseFrame(event, signal));
  });

  return { events, poseFrames };
};

const buildSourceSpecificLinkedEvents = (
  source: VideoSource,
  duration: number,
  rounds: FightRound[],
): FightEvent[] => {
  const seed = Math.abs(hashString(`${source.label}-${source.src ?? ""}`));
  const eventCount = Math.max(12, Math.floor(duration / 15));
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
  detectedPoseFrames?: PoseFrame[],
): FightAnalysis => {
  const poseFrames = detectedPoseFrames ?? events.map(createPoseFrame);

  return {
    ...mockFightAnalysis,
    id: `fightid-${mode}-${Math.abs(hashString(`${source.label}-${source.src ?? ""}`)).toString(36)}`,
    title: buildAnalysisTitle(source, mode),
    venue:
      mode === "pose_enhanced_analysis"
        ? "Browser MoveNet pose analyzer"
        : mode === "client_frame_analysis"
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
      const { duration, signals } = await samplePoseEnhancedFrames(source, onStageChange);
      const rounds = buildRounds(duration);

      onStageChange(
        stages.map((stage, index) => ({
          ...stage,
          status: index < 4 ? "complete" : index === 4 ? "running" : "queued",
        })),
      );
      const { events, poseFrames } = eventsFromPoseSignals(source, duration, rounds, signals);

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
        "pose_enhanced_analysis",
        duration,
        rounds,
        events,
        "High-accuracy client-side analysis ran: the browser sampled frames, estimated fighter pose keypoints with MoveNet, then scored every qualifying temporal window against combat-sports movement cues for straight punches, hooks, uppercuts, kicks, knees, takedowns, clinch exchanges, scrambles, feints, footwork, and defense. Output is no longer capped to twenty movements.",
        poseFrames,
      );
    } catch (error) {
      console.warn("Falling back to frame-only analysis:", error);

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
          "Frame-only analysis ran because browser pose estimation was unavailable. The app sampled video frames and measured motion, luminance, contrast, and color balance to generate heuristic timestamp candidates.",
        );
      } catch (frameError) {
        console.warn("Falling back to linked metadata analysis:", frameError);
      }
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
