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

export class ObservationChartValidationError extends Error {}

function compatible(observations: TextObservation[]): boolean {
  return (
    observations.length >= 2 &&
    new Set(observations.map((item) => item.unit)).size === 1
  );
}
type ParsedPeriod = { key: string; rank: number };

/** Parse the complete period token. Substring matches are deliberately rejected. */
function parsePeriod(period: string): ParsedPeriod | undefined {
  const value = period
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/^(?:в|за|на|к|по)\s+/u, "");
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      return undefined;
    return { key: `${year}-${month}-${day}`, rank: date.getTime() };
  }
  const months = [
    /январ(?:ь|я|е|ю|ём|ем)?/u,
    /феврал(?:ь|я|е|ю|ём|ем)?/u,
    /март(?:а|е|у|ом)?/u,
    /апрел(?:ь|я|е|ю|ем)?/u,
    /ма(?:й|я|е|ю|ем)/u,
    /июн(?:ь|я|е|ю|ем)?/u,
    /июл(?:ь|я|е|ю|ем)?/u,
    /август(?:а|е|у|ом)?/u,
    /сентябр(?:ь|я|е|ю|ем)?/u,
    /октябр(?:ь|я|е|ю|ем)?/u,
    /ноябр(?:ь|я|е|ю|ем)?/u,
    /декабр(?:ь|я|е|ю|ем)?/u,
    /january/u,
    /february/u,
    /march/u,
    /april/u,
    /may/u,
    /june/u,
    /july/u,
    /august/u,
    /september/u,
    /october/u,
    /november/u,
    /december/u,
  ];
  const monthPattern = months.map((item) => item.source).join("|");
  const named = value.match(
    new RegExp(
      `^(?:(\\d{1,2})\\s+)?(${monthPattern})(?:\\s+(\\d{4})(?:\\s+г(?:од(?:а|у|ом|е)?)?\\.?)?)?$`,
      "u",
    ),
  );
  if (!named) return undefined;
  const month =
    months.findIndex((item) =>
      new RegExp(`^(?:${item.source})$`, "u").test(named[2] as string),
    ) % 12;
  const day = named[1] ? Number(named[1]) : undefined;
  const year = named[3] ? Number(named[3]) : 0;
  if (month < 0 || (day !== undefined && (day < 1 || day > 31)))
    return undefined;
  if (day !== undefined) {
    // 2000 is a leap year, so yearless 29 February remains valid while
    // impossible day/month combinations are still rejected deterministically.
    const date = new Date(Date.UTC(year || 2000, month, day));
    if (date.getUTCMonth() !== month || date.getUTCDate() !== day)
      return undefined;
  }
  const rank = Date.UTC(year, month, day ?? 1);
  return {
    key:
      day === undefined
        ? `${year}-${month + 1}`
        : `${year}-${month + 1}-${day}`,
    rank,
  };
}

/** Builds points only for explicit model-proposed groups after compatibility checks. */
export function calculateObservationCharts(
  observations: TextObservation[],
  groups: TextChartGroup[],
  evidenceId: (observationId: string) => string,
  options: { strict?: boolean } = {},
): ObservationChart[] {
  const reject = (message: string): false => {
    if (options.strict) throw new ObservationChartValidationError(message);
    return false;
  };
  const byId = new Map(
    observations.map((observation) => [observation.id, observation]),
  );
  const charts: ObservationChart[] = [];
  for (const group of groups) {
    const operation = group.operation ?? "none";
    if (new Set(group.observationIds).size !== group.observationIds.length)
      reject("Chart observation IDs must be unique.");
    if (new Set(group.observationIds).size !== group.observationIds.length)
      continue;
    const selected = group.observationIds.map((id) => byId.get(id));
    if (selected.some((observation) => observation === undefined)) {
      reject("Chart references an unknown observation.");
      continue;
    }
    const items = selected as TextObservation[];
    if (!compatible(items)) {
      reject("Chart observations use incompatible units.");
      continue;
    }
    if (
      group.derivation === "direct" &&
      (items.some((item) => item.role !== "snapshot") ||
        (group.kind === "bar" &&
          (new Set(items.map((item) => item.subject)).size !== items.length ||
            new Set(items.map((item) => item.period)).size > 1)))
    ) {
      reject(
        "Direct bar charts require distinct snapshot subjects in one period context.",
      );
      continue;
    }
    if (
      group.derivation === "current-target" &&
      (group.kind !== "bar" || operation !== "none")
    ) {
      reject("Current-target charts require a bar and no operation.");
      continue;
    }
    if (
      group.derivation === "baseline-change" &&
      (group.kind !== "bar" || operation === "none")
    ) {
      reject("Baseline-change charts require a bar and an operation.");
      continue;
    }
    if (group.kind === "line") {
      const periods = items.map((item) =>
        item.period === null ? undefined : parsePeriod(item.period),
      );
      if (
        items.some((item) => item.period === null) ||
        new Set(items.map((item) => item.subject)).size !== 1 ||
        periods.some((period) => period === undefined) ||
        group.derivation !== "direct"
      ) {
        reject(
          "Line charts require one snapshot subject and explicit periods.",
        );
        continue;
      }
      const periodKeys = periods.map((period) => period?.key);
      if (new Set(periodKeys).size !== periodKeys.length) {
        reject("Line charts require distinct normalized periods.");
        continue;
      }
      items.sort((left, right) => {
        return (
          (parsePeriod(left.period as string)?.rank ?? 0) -
          (parsePeriod(right.period as string)?.rank ?? 0)
        );
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
      ) {
        reject("Current-target chart roles are incompatible.");
        continue;
      }
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
        operation === "none" ||
        new Set(items.map((item) => item.subject)).size !== 1 ||
        (operation === "increase" && change.value < 0) ||
        (operation === "decrease" && change.value > 0)
      ) {
        reject("Baseline-change chart roles are incompatible.");
        continue;
      }
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
    if (evidenceIds.some((id) => id.length === 0)) {
      reject("Chart observations require quote evidence.");
      continue;
    }
    const title =
      group.derivation === "current-target"
        ? "Текущее значение и цель"
        : group.derivation === "baseline-change"
          ? "База и изменение"
          : group.kind === "line"
            ? `Динамика: ${items[0]?.subject ?? "показатель"}`
            : "Сравнение показателей";
    const rationale =
      group.derivation === "current-target"
        ? "Сопоставление проверенного текущего значения и цели"
        : group.derivation === "baseline-change"
          ? "База, явное изменение и рассчитанный итог"
          : group.kind === "line"
            ? "Один показатель по явно указанным периодам"
            : "Сопоставление совместимых показателей источника";
    charts.push({
      id: group.id,
      kind: group.kind,
      title,
      rationale,
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
