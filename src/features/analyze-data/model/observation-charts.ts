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
function periodRank(period: string): number | undefined {
  const normalized = period.toLocaleLowerCase("ru-RU");
  const iso = normalized.match(/\b(\d{4})-(\d{2})(?:-\d{2})?\b/u);
  if (iso) return Number(iso[1]) * 12 + Number(iso[2]) - 1;
  const monthStems = [
    ["январ", "january"],
    ["феврал", "february"],
    ["март", "march"],
    ["апрел", "april"],
    ["мая", "май", "may"],
    ["июн", "june"],
    ["июл", "july"],
    ["август", "august"],
    ["сентябр", "september"],
    ["октябр", "october"],
    ["ноябр", "november"],
    ["декабр", "december"],
  ];
  const month = monthStems.findIndex((stems) =>
    stems.some((stem) => normalized.includes(stem)),
  );
  if (month < 0) return undefined;
  const year = normalized.match(/\b(19|20)\d{2}\b/u)?.[0];
  return year ? Number(year) * 12 + month : month;
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
      items.sort((left, right) => {
        const leftRank = periodRank(left.period as string);
        const rightRank = periodRank(right.period as string);
        if (leftRank === undefined || rightRank === undefined) return 0;
        return leftRank - rightRank;
      });
    }
    let points: Array<{ label: string; value: number }>;
    if (group.derivation === "current-target") {
      const targets = items.filter((item) => item.role === "target");
      const snapshots = items.filter((item) => item.role === "snapshot");
      if (
        targets.length !== 1 ||
        snapshots.length < 1 ||
        snapshots.length + targets.length !== items.length
      )
        continue;
      const target = targets[0] as TextObservation;
      points = [
        {
          label: "Текущее значение (расчёт)",
          value: snapshots.reduce((sum, item) => sum + item.value, 0),
        },
        { label: "Цель", value: target.value },
      ];
    } else if (group.derivation === "baseline-change") {
      const snapshots = items.filter((item) => item.role === "snapshot");
      const changes = items.filter((item) => item.role === "change");
      const baseline = snapshots[0];
      const change = changes[0];
      if (
        snapshots.length !== 1 ||
        changes.length !== 1 ||
        items.length !== 2 ||
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
