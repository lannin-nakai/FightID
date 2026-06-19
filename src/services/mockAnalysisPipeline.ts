import { mockFightAnalysis } from "../data/mockFight";
import type { FightAnalysis, VideoSource } from "../types/fight";

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

export const runMockFightAnalysis = async (
  source: VideoSource,
  onStageChange: (stages: PipelineStage[]) => void,
): Promise<FightAnalysis> => {
  const stages = createPipelineStages();

  for (let index = 0; index < stages.length; index += 1) {
    const runningStages = stages.map((stage, stageIndex) => ({
      ...stage,
      status:
        stageIndex < index ? "complete" : stageIndex === index ? "running" : "queued",
    })) satisfies PipelineStage[];

    onStageChange(runningStages);
    await wait(source.kind === "sample" ? 230 : 320);
  }

  onStageChange(stages.map((stage) => ({ ...stage, status: "complete" })));

  /*
   * Real integration point:
   * - Send source metadata to a backend ingestion endpoint.
   * - Run frame extraction with FFmpeg or a managed media pipeline.
   * - Pass sampled frames through fighter tracking and pose estimation models.
   * - Feed pose windows, optical flow, and object tracks to movement classifiers.
   * - Return the same FightAnalysis shape used by this prototype so the UI remains stable.
   */
  return {
    ...mockFightAnalysis,
    title:
      source.kind === "sample"
        ? mockFightAnalysis.title
        : `${mockFightAnalysis.title} | Mock analysis for ${source.label}`,
  };
};
