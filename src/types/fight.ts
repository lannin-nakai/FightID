export type FighterId = "red" | "blue";

export type MovementType =
  | "jab"
  | "cross"
  | "hook"
  | "uppercut"
  | "low_kick"
  | "body_kick"
  | "head_kick"
  | "knee"
  | "elbow"
  | "feint"
  | "counter"
  | "takedown_attempt"
  | "successful_takedown"
  | "clinch_exchange"
  | "scramble"
  | "defensive_movement"
  | "footwork_pattern"
  | "knockdown"
  | "momentum_shift";

export type EventResult =
  | "landed"
  | "missed"
  | "blocked"
  | "successful"
  | "stuffed"
  | "defended"
  | "transition"
  | "created_space"
  | "momentum_shift";

export type EventImpact = "low" | "medium" | "high" | "critical";

export interface Fighter {
  id: FighterId;
  name: string;
  corner: "Red" | "Blue";
  stance: "Orthodox" | "Southpaw" | "Switch";
  record: string;
  reach: string;
  avatarGradient: string;
  accentClass: string;
}

export interface FightRound {
  number: number;
  startsAt: number;
  endsAt: number;
}

export interface PoseKeypoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface PoseFrame {
  id: string;
  timestamp: number;
  fighterId: FighterId;
  movementType: MovementType;
  keypoints: PoseKeypoint[];
  highlightedJoints: string[];
  facing: "left" | "right";
}

export interface FightEvent {
  id: string;
  fighterId: FighterId;
  opponentId: FighterId;
  movementType: MovementType;
  label: string;
  result: EventResult;
  impact: EventImpact;
  round: number;
  timestamp: number;
  durationSec: number;
  confidence: number;
  significant: boolean;
  notes: string;
  poseFrameId: string;
}

export interface VideoSource {
  kind: "sample" | "upload" | "url";
  label: string;
  src?: string;
}

export interface EventFilters {
  movementType: MovementType | "all";
  fighterId: FighterId | "all";
  round: number | "all";
  result: EventResult | "all";
  minConfidence: number;
}

export interface FighterStats {
  fighterId: FighterId;
  totalStrikes: number;
  significantStrikes: number;
  strikeAttempts: number;
  strikeAccuracy: number;
  takedownAttempts: number;
  successfulTakedowns: number;
  clinchTime: number;
  knockdowns: number;
  feints: number;
  defensiveReactions: number;
  strikeTypeBreakdown: Record<string, number>;
}

export interface RoundStats {
  round: number;
  byFighter: Record<FighterId, FighterStats>;
  momentumScore: Record<FighterId, number>;
}

export interface MomentumPoint {
  timestamp: number;
  round: number;
  red: number;
  blue: number;
  label: string;
}

export interface FightStats {
  byFighter: Record<FighterId, FighterStats>;
  roundStats: RoundStats[];
  momentumTimeline: MomentumPoint[];
  eventCount: number;
  averageConfidence: number;
}

export interface FightAnalysis {
  id: string;
  title: string;
  venue: string;
  date: string;
  duration: number;
  fighters: Record<FighterId, Fighter>;
  rounds: FightRound[];
  events: FightEvent[];
  poseFrames: PoseFrame[];
  stats: FightStats;
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  jab: "Jab",
  cross: "Cross",
  hook: "Hook",
  uppercut: "Uppercut",
  low_kick: "Low kick",
  body_kick: "Body kick",
  head_kick: "Head kick",
  knee: "Knee",
  elbow: "Elbow",
  feint: "Feint",
  counter: "Counter",
  takedown_attempt: "Takedown attempt",
  successful_takedown: "Successful takedown",
  clinch_exchange: "Clinch exchange",
  scramble: "Scramble",
  defensive_movement: "Defensive movement",
  footwork_pattern: "Footwork pattern",
  knockdown: "Knockdown",
  momentum_shift: "Momentum shift",
};

export const RESULT_LABELS: Record<EventResult, string> = {
  landed: "Landed",
  missed: "Missed",
  blocked: "Blocked",
  successful: "Successful",
  stuffed: "Stuffed",
  defended: "Defended",
  transition: "Transition",
  created_space: "Created space",
  momentum_shift: "Momentum shift",
};
