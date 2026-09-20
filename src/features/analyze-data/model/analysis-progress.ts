export const ANALYSIS_PROGRESS_CONFIG = {
  table: { estimateMs: 22_000 },
  text: { estimateMs: 20_000 },
  estimatedCap: 95,
  completionStageDelayMs: 180,
  completionHoldMs: 650,
} as const;

export const ANALYSIS_STAGE_THRESHOLDS = [0, 20, 50, 75] as const;

type AnalysisSourceKind = keyof Pick<
  typeof ANALYSIS_PROGRESS_CONFIG,
  "table" | "text"
>;

const progressCheckpoints = [
  { fraction: 0, value: 0 },
  { fraction: 0.035, value: 5 },
  { fraction: 0.08, value: 11 },
  { fraction: 0.14, value: 19 },
  { fraction: 0.22, value: 30 },
  { fraction: 0.31, value: 42 },
  { fraction: 0.42, value: 54 },
  { fraction: 0.54, value: 65 },
  { fraction: 0.65, value: 74 },
  { fraction: 0.75, value: 81 },
  { fraction: 0.83, value: 87 },
  { fraction: 0.9, value: 91 },
  { fraction: 0.95, value: 93 },
  { fraction: 1, value: ANALYSIS_PROGRESS_CONFIG.estimatedCap },
] as const;

type ProgressCheckpoint = { atMs: number; value: number };

export function getAnalysisProgressSchedule(
  sourceKind: AnalysisSourceKind,
): readonly ProgressCheckpoint[] {
  const duration = ANALYSIS_PROGRESS_CONFIG[sourceKind].estimateMs;
  return progressCheckpoints.map((checkpoint, index) => ({
    atMs:
      index === progressCheckpoints.length - 1
        ? duration
        : Math.round(checkpoint.fraction * duration),
    value: checkpoint.value,
  }));
}

export function nextAnalysisProgressDelay(
  elapsedMs: number,
  sourceKind: AnalysisSourceKind,
): number | undefined {
  const next = getAnalysisProgressSchedule(sourceKind).find(
    (checkpoint) => checkpoint.atMs > elapsedMs,
  );
  return next ? next.atMs - Math.max(0, elapsedMs) : undefined;
}

export function estimateAnalysisProgress(
  elapsedMs: number,
  sourceKind: AnalysisSourceKind,
): number {
  const checkpoint = [...getAnalysisProgressSchedule(sourceKind)]
    .reverse()
    .find((candidate) => candidate.atMs <= elapsedMs);
  return checkpoint?.value ?? 0;
}

export function analysisStageIndex(
  progress: number,
  isSessionSetup: boolean,
): number | undefined {
  if (progress >= 100) return undefined;
  if (isSessionSetup) return 0;
  const index = [...ANALYSIS_STAGE_THRESHOLDS]
    .map((threshold, candidate) => ({ threshold, candidate }))
    .reverse()
    .find(({ threshold }) => progress >= threshold)?.candidate;
  return Math.max(1, index ?? 1);
}

export function completionProgressSequence(
  progress: number,
): readonly number[] {
  return [...ANALYSIS_STAGE_THRESHOLDS.slice(2), 100].filter(
    (checkpoint) => checkpoint > progress,
  );
}
