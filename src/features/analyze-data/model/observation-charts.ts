import type { TextObservation } from "@/entities/report";

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

const monthRank = new Map(
  [
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
  ].map((month, index) => [month, index]),
);
function periodRank(period: string): number {
  const month = monthRank.get(
    period.toLocaleLowerCase("ru-RU").split(/\s+/u)[0] ?? "",
  );
  return month === undefined ? Number.MAX_SAFE_INTEGER : month;
}

/** Builds only additive, same-concept observation series; targets stay separate. */
export function calculateObservationCharts(
  observations: TextObservation[],
  evidenceId: (observationId: string) => string,
): ObservationChart[] {
  const snapshots = observations.filter(
    (observation) => observation.role === "snapshot",
  );
  const charts: ObservationChart[] = [];
  const species = snapshots.filter(
    (observation) => observation.period === null,
  );
  const speciesCompatible =
    species.length >= 2 && new Set(species.map((item) => item.unit)).size === 1;
  if (speciesCompatible) {
    charts.push({
      id: "observations-by-subject",
      kind: "bar",
      title: "Наблюдения по категориям",
      rationale:
        "Сравнивает явно указанные категории с совместимой единицей измерения.",
      aggregation: {
        kind: "count",
        dimensionFieldId: "subject",
        dimensionLabel: "Source subject",
      },
      observationIds: species.map((item) => item.id),
      points: species.map((item) => ({
        label: item.subject,
        value: item.value,
      })),
      evidenceIds: species.map((item) => evidenceId(item.id)),
    });
  }
  const targets = observations.filter(
    (observation) => observation.role === "target",
  );
  const target = targets[0];
  if (target && speciesCompatible) {
    charts.push({
      id: "observations-current-target",
      kind: "bar",
      title: "Текущее значение и цель",
      rationale:
        "Цель показана отдельно и не включена в категории текущих наблюдений.",
      aggregation: {
        kind: "count",
        dimensionFieldId: "target",
        dimensionLabel: "Цель",
      },
      observationIds: [...species.map((item) => item.id), target.id],
      points: [
        {
          label: "Текущее значение (расчёт)",
          value: species.reduce((sum, item) => sum + item.value, 0),
        },
        { label: "Цель", value: target.value },
      ],
      evidenceIds: [...species, target].map((item) => evidenceId(item.id)),
    });
  }
  for (const subject of new Set(observations.map((item) => item.subject))) {
    const baseline =
      observations
        .filter((item) => item.subject === subject && item.role === "snapshot")
        .findLast((item) => item.period !== null) ??
      observations.find(
        (item) => item.subject === subject && item.role === "snapshot",
      );
    const change = observations.find(
      (item) => item.subject === subject && item.role === "change",
    );
    if (
      !baseline ||
      !change ||
      (baseline.unit !== change.unit &&
        baseline.unit !== null &&
        change.unit !== null)
    )
      continue;
    charts.push({
      id: `observations-change-${charts.length}`,
      kind: "bar",
      title: `${subject}: база и изменение`,
      rationale:
        "Итог рассчитан из явно указанной базы и изменения с сохранением их источников.",
      aggregation: {
        kind: "count",
        dimensionFieldId: "role",
        dimensionLabel: "Роль наблюдения",
      },
      observationIds: [baseline.id, change.id],
      points: [
        { label: "База", value: baseline.value },
        { label: "Изменение", value: change.value },
        { label: "Итого (расчёт)", value: baseline.value + change.value },
      ],
      evidenceIds: [evidenceId(baseline.id), evidenceId(change.id)],
    });
  }
  const seriesBySubject = new Map<string, TextObservation[]>();
  for (const observation of snapshots.filter((item) => item.period !== null)) {
    const key = `${observation.subject}\u0000${observation.unit ?? ""}`;
    seriesBySubject.set(key, [
      ...(seriesBySubject.get(key) ?? []),
      observation,
    ]);
  }
  for (const series of seriesBySubject.values()) {
    const periods = new Set(series.map((item) => item.period));
    if (series.length < 2 || periods.size < 2) continue;
    charts.push({
      id: `observations-over-time-${charts.length}`,
      kind: "line",
      title: `${series[0]?.subject ?? "Наблюдение"}: динамика`,
      rationale:
        "Показывает явные наблюдения одного предмета по указанным периодам.",
      aggregation: {
        kind: "count",
        dimensionFieldId: "period",
        dimensionLabel: "Source period",
      },
      observationIds: series.map((item) => item.id),
      points: [...series]
        .sort(
          (left, right) =>
            periodRank(left.period as string) -
            periodRank(right.period as string),
        )
        .map((item) => ({ label: item.period as string, value: item.value })),
      evidenceIds: series.map((item) => evidenceId(item.id)),
    });
  }
  return charts.slice(0, 3);
}
