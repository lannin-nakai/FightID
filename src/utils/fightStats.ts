import type {
  EventImpact,
  FightEvent,
  FightRound,
  FightStats,
  FighterId,
  FighterStats,
  MomentumPoint,
  MovementType,
  RoundStats,
} from "../types/fight";
import { MOVEMENT_LABELS } from "../types/fight";

export const STRIKE_TYPES: MovementType[] = [
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

const FIGHTERS: FighterId[] = ["red", "blue"];

const emptyFighterStats = (fighterId: FighterId): FighterStats => ({
  fighterId,
  totalStrikes: 0,
  significantStrikes: 0,
  strikeAttempts: 0,
  strikeAccuracy: 0,
  takedownAttempts: 0,
  successfulTakedowns: 0,
  clinchTime: 0,
  knockdowns: 0,
  feints: 0,
  defensiveReactions: 0,
  strikeTypeBreakdown: Object.fromEntries(
    STRIKE_TYPES.map((movement) => [MOVEMENT_LABELS[movement], 0]),
  ),
});

const impactScore: Record<EventImpact, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 7,
};

const scoreEvent = (event: FightEvent): number => {
  const resultBonus =
    event.result === "landed" || event.result === "successful"
      ? 2
      : event.result === "momentum_shift"
        ? 3
        : event.result === "blocked"
          ? 0.5
          : 0;

  return impactScore[event.impact] + resultBonus + (event.significant ? 1 : 0);
};

const applyEventToStats = (stats: FighterStats, event: FightEvent) => {
  if (STRIKE_TYPES.includes(event.movementType)) {
    stats.strikeAttempts += 1;

    if (event.result === "landed") {
      stats.totalStrikes += 1;
    }

    if (event.significant && event.result === "landed") {
      stats.significantStrikes += 1;
    }

    const label = MOVEMENT_LABELS[event.movementType];
    stats.strikeTypeBreakdown[label] = (stats.strikeTypeBreakdown[label] ?? 0) + 1;
  }

  if (event.movementType === "takedown_attempt") {
    stats.takedownAttempts += 1;
  }

  if (event.movementType === "successful_takedown") {
    stats.takedownAttempts += 1;
    stats.successfulTakedowns += 1;
  }

  if (event.movementType === "clinch_exchange") {
    stats.clinchTime += event.durationSec;
  }

  if (event.movementType === "knockdown") {
    stats.knockdowns += 1;
  }

  if (event.movementType === "feint") {
    stats.feints += 1;
  }

  if (event.movementType === "defensive_movement") {
    stats.defensiveReactions += 1;
  }
};

const finalizeFighterStats = (stats: FighterStats): FighterStats => ({
  ...stats,
  strikeAccuracy:
    stats.strikeAttempts === 0
      ? 0
      : Math.round((stats.totalStrikes / stats.strikeAttempts) * 100),
  clinchTime: Math.round(stats.clinchTime),
});

const buildStatsForEvents = (events: FightEvent[]): Record<FighterId, FighterStats> => {
  const byFighter: Record<FighterId, FighterStats> = {
    red: emptyFighterStats("red"),
    blue: emptyFighterStats("blue"),
  };

  events.forEach((event) => {
    applyEventToStats(byFighter[event.fighterId], event);
  });

  return {
    red: finalizeFighterStats(byFighter.red),
    blue: finalizeFighterStats(byFighter.blue),
  };
};

const buildRoundStats = (events: FightEvent[], rounds: FightRound[]): RoundStats[] =>
  rounds.map((round) => {
    const roundEvents = events.filter((event) => event.round === round.number);
    const momentumScore: Record<FighterId, number> = { red: 0, blue: 0 };

    roundEvents.forEach((event) => {
      momentumScore[event.fighterId] += scoreEvent(event);
      if (event.result === "defended" || event.result === "blocked") {
        momentumScore[event.opponentId] += 0.5;
      }
    });

    return {
      round: round.number,
      byFighter: buildStatsForEvents(roundEvents),
      momentumScore,
    };
  });

const buildMomentumTimeline = (events: FightEvent[]): MomentumPoint[] => {
  let red = 50;
  let blue = 50;

  return events
    .filter((event) => event.impact === "high" || event.impact === "critical")
    .map((event) => {
      const delta = scoreEvent(event);

      if (event.fighterId === "red") {
        red = Math.min(100, red + delta);
        blue = Math.max(0, blue - delta * 0.6);
      } else {
        blue = Math.min(100, blue + delta);
        red = Math.max(0, red - delta * 0.6);
      }

      return {
        timestamp: event.timestamp,
        round: event.round,
        red: Math.round(red),
        blue: Math.round(blue),
        label: event.label,
      };
    });
};

export const aggregateFightStats = (
  events: FightEvent[],
  rounds: FightRound[],
): FightStats => {
  const confidenceTotal = events.reduce((sum, event) => sum + event.confidence, 0);

  return {
    byFighter: buildStatsForEvents(events),
    roundStats: buildRoundStats(events, rounds),
    momentumTimeline: buildMomentumTimeline(events),
    eventCount: events.length,
    averageConfidence:
      events.length === 0 ? 0 : Math.round((confidenceTotal / events.length) * 100),
  };
};
