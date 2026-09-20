import type { TextChartGroup, TextObservation } from "@/entities/report";

export type ObservationChart = {
  id: string;
  kind: "bar" | "line";
  title: string;
  rationale: string;
  aggregation: {
    kind: "count";
    dimensionFieldId: string;
    dimensionLabel: string;
  };
  observationIds: string[];
  points: Array<{ label: string; value: number }>;
  evidenceIds: string[];
};

function compatible(observations: TextObservation[]): boolean {
  return (
    observations.length >= 2 &&
    new Set(observations.map((item) => item.unit)).size === 1
  );
}
function monthRank(period: string): number {
  const months = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
  ];
  const value = months.indexOf(
    period.toLocaleLowerCase("ru-RU").split(/\s+/u)[0] ?? "",
  );
  return value < 0 ? Number.MAX_SAFE_INTEGER : value;
}

/** Builds points only for explicit model-proposed groups after compatibility checks. */
export function calculateObservationCharts(
  observations: TextObservation[],
  groups: TextChartGroup[],
  evidenceId: (observationId: string) => string,
): ObservationChart[] {
  const byId = new Map(
    observations.map((observation) => [observation.id, observation]),
  );
  const charts: ObservationChart[] = [];
  for (const group of groups) {
    if (new Set(group.observationIds).size !== group.observationIds.length)
      continue;
    const selected = group.observationIds.map((id) => byId.get(id));
    if (selected.some((observation) => observation === undefined)) continue;
    const items = selected as TextObservation[];
    if (!compatible(items)) continue;
    if (group.kind === "line") {
      if (
        items.some((item) => item.period === null) ||
        new Set(items.map((item) => item.subject)).size !== 1
      )
        continue;
      items.sort(
        (left, right) =>
          monthRank(left.period as string) - monthRank(right.period as string),
      );
    }
    let points: Array<{ label: string; value: number }>;
    if (group.derivation === "current-target") {
      const target = items.find((item) => item.role === "target");
      const snapshots = items.filter((item) => item.role === "snapshot");
      if (!target || snapshots.length < 1) continue;
      points = [
        {
          label: "Текущее значение (расчёт)",
          value: snapshots.reduce((sum, item) => sum + item.value, 0),
        },
        { label: "Цель", value: target.value },
      ];
    } else if (group.derivation === "baseline-change") {
      const baseline = items.find((item) => item.role === "snapshot");
      const change = items.find((item) => item.role === "change");
      if (
        !baseline ||
        !change ||
        group.operation === "none" ||
        new Set(items.map((item) => item.subject)).size !== 1 ||
        (group.operation === "increase" && change.value < 0) ||
        (group.operation === "decrease" && change.value > 0)
      )
        continue;
      points = [
        { label: "База", value: baseline.value },
        { label: "Изменение", value: change.value },
        {
          label: "Итого (расчёт)",
          value: baseline.value + change.value,
        },
      ];
    } else {
      points = items.map((item) => ({
        label: group.kind === "line" ? (item.period as string) : item.subject,
        value: item.value,
      }));
    }
    const evidenceIds = items.map((item) => evidenceId(item.id));
    if (evidenceIds.some((id) => id.length === 0)) continue;
    charts.push({
      id: group.id,
      kind: group.kind,
      title: group.title,
      rationale: group.rationale,
      aggregation: {
        kind: "count",
        dimensionFieldId: "observation",
        dimensionLabel: group.kind === "line" ? "Период" : "Категория",
      },
      observationIds: items.map((item) => item.id),
      points,
      evidenceIds,
    });
  }
  return charts;
}
