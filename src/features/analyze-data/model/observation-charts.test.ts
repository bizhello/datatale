import { describe, expect, it } from "vitest";
import { calculateObservationCharts } from "./observation-charts";

const observation = (
  id: string,
  subject: string,
  value: number,
  period: string | null = null,
  role: "snapshot" | "change" | "target" = "snapshot",
) => ({
  id,
  subject,
  value,
  unit: null,
  period,
  role,
  paragraphIndex: 1,
  quote: `${subject}: ${value}`,
});

describe("calculateObservationCharts", () => {
  it("builds a subject bar from compatible snapshots without including targets", () => {
    const charts = calculateObservationCharts(
      [
        observation("dogs", "dogs", 5),
        observation("cats", "cats", 3),
        observation("parrot", "parrot", 1),
        observation("target", "target", 20, null, "target"),
      ],
      [
        {
          id: "animals",
          kind: "bar",
          title: "Животные",
          rationale: "Сравнение",
          observationIds: ["dogs", "cats", "parrot"],
          derivation: "direct",
        },
      ],
      (id) => `e-${id}`,
    );
    expect(charts[0]?.kind).toBe("bar");
    expect(charts[0]?.aggregation.dimensionLabel).toBe("Категория");
    expect(charts[0]?.points).toEqual([
      { label: "dogs", value: 5 },
      { label: "cats", value: 3 },
      { label: "parrot", value: 1 },
    ]);
  });

  it("builds a line only for one subject across explicit periods", () => {
    const charts = calculateObservationCharts(
      [
        observation("jan", "Revenue", 100, "January"),
        observation("feb", "Revenue", 150, "February"),
      ],
      [
        {
          id: "revenue",
          kind: "line",
          title: "Динамика",
          rationale: "Периоды",
          observationIds: ["jan", "feb"],
          derivation: "direct",
        },
      ],
      (id) => `e-${id}`,
    );
    expect(charts[0]?.kind).toBe("line");
    expect(charts[0]?.aggregation.dimensionLabel).toBe("Период");
    expect(charts[0]?.points).toEqual([
      { label: "January", value: 100 },
      { label: "February", value: 150 },
    ]);
  });

  it("orders Russian inflected month periods across years", () => {
    const charts = calculateObservationCharts(
      [
        observation("jan", "Revenue", 150, "в январе 2026"),
        observation("dec", "Revenue", 100, "декабрь 2025"),
      ],
      [
        {
          id: "dated-revenue",
          kind: "line",
          title: "Динамика",
          rationale: "Периоды",
          observationIds: ["jan", "dec"],
          derivation: "direct",
        },
      ],
      (id) => `e-${id}`,
    );
    expect(charts[0]?.points).toEqual([
      { label: "декабрь 2025", value: 100 },
      { label: "в январе 2026", value: 150 },
    ]);
  });

  it("orders ISO daily periods by their complete date", () => {
    const charts = calculateObservationCharts(
      [
        observation("second", "Revenue", 150, "2026-09-02"),
        observation("first", "Revenue", 100, "2026-09-01"),
      ],
      [
        {
          id: "daily-revenue",
          kind: "line",
          title: "Динамика",
          rationale: "Дни",
          observationIds: ["second", "first"],
          derivation: "direct",
        },
      ],
      (id) => `e-${id}`,
    );
    expect(charts[0]?.points).toEqual([
      { label: "2026-09-01", value: 100 },
      { label: "2026-09-02", value: 150 },
    ]);
  });

  it("orders ISO and named dated periods on the same time scale", () => {
    const charts = calculateObservationCharts(
      [
        observation("february", "Revenue", 150, "февраль 2026"),
        observation("january", "Revenue", 100, "2026-01-01"),
      ],
      [
        {
          id: "mixed-dates",
          kind: "line",
          title: "Динамика",
          rationale: "Периоды",
          observationIds: ["february", "january"],
          derivation: "direct",
        },
      ],
      (id) => `e-${id}`,
    );
    expect(charts[0]?.points.map((point) => point.label)).toEqual([
      "2026-01-01",
      "февраль 2026",
    ]);
  });

  it("keeps a target outside species and preserves a baseline plus change", () => {
    const charts = calculateObservationCharts(
      [
        observation("dogs", "dogs", 5),
        observation("cats", "cats", 3),
        observation("parrot", "parrot", 1),
        observation("target", "total", 20, null, "target"),
        observation("cats-yesterday", "cats", 3, "yesterday"),
        observation("cats-change", "cats", 2, "today", "change"),
      ],
      [
        {
          id: "target",
          kind: "bar",
          title: "Цель",
          rationale: "Разрыв",
          observationIds: ["dogs", "cats", "parrot", "target"],
          derivation: "current-target",
        },
        {
          id: "change",
          kind: "bar",
          title: "Изменение",
          rationale: "Расчёт",
          observationIds: ["cats-yesterday", "cats-change"],
          derivation: "baseline-change",
          operation: "increase",
        },
      ],
      (id) => `e-${id}`,
    );
    const target = charts.find((chart) => chart.id === "target");
    expect(target?.points).toContainEqual({
      label: "Текущее значение (расчёт)",
      value: 9,
    });
    expect(target?.points).not.toContainEqual({ label: "total", value: 20 });
    const change = charts.find((chart) => chart.id === "change");
    expect(change?.points).toContainEqual({
      label: "Итого (расчёт)",
      value: 5,
    });
    expect(change?.observationIds).toEqual(["cats-yesterday", "cats-change"]);
  });

  it("does not combine incompatible units or qualitative input", () => {
    const mixed = [
      observation("a", "dogs", 5),
      { ...observation("b", "revenue", 10), unit: "RUB" },
    ];
    expect(
      calculateObservationCharts(
        mixed,
        [
          {
            id: "mixed",
            kind: "bar",
            title: "Mixed",
            rationale: "Mixed",
            observationIds: ["a", "b"],
            derivation: "direct",
          },
        ],
        (id) => id,
      ),
    ).toEqual([]);
    expect(calculateObservationCharts([], [], (id) => id)).toEqual([]);
  });

  it("rejects duplicate observation IDs instead of counting a value twice", () => {
    expect(
      calculateObservationCharts(
        [observation("a", "A", 5), observation("target", "Target", 10)],
        [
          {
            id: "duplicate",
            kind: "bar",
            title: "Duplicate",
            rationale: "Invalid",
            observationIds: ["a", "a", "target"],
            derivation: "current-target",
          },
        ],
        (id) => id,
      ),
    ).toEqual([]);
  });

  it("treats change observations as signed deltas", () => {
    const charts = calculateObservationCharts(
      [
        observation("baseline", "A", 5),
        observation("change", "A", -2, "today", "change"),
      ],
      [
        {
          id: "signed-change",
          kind: "bar",
          title: "Signed change",
          rationale: "Signed delta",
          observationIds: ["baseline", "change"],
          derivation: "baseline-change",
          operation: "decrease",
        },
      ],
      (id) => id,
    );
    expect(charts[0]?.points).toContainEqual({
      label: "Итого (расчёт)",
      value: 3,
    });
  });

  it("rejects ambiguous derivation role cardinality", () => {
    const observations = [
      observation("baseline", "A", 5),
      observation("second-baseline", "A", 4),
      observation("change", "A", 2, "today", "change"),
      observation("target-a", "A", 10, null, "target"),
      observation("target-b", "A", 12, null, "target"),
    ];
    expect(
      calculateObservationCharts(
        observations,
        [
          {
            id: "ambiguous-target",
            kind: "bar",
            title: "Target",
            rationale: "Invalid",
            observationIds: ["baseline", "target-a", "target-b"],
            derivation: "current-target",
          },
          {
            id: "ambiguous-change",
            kind: "bar",
            title: "Change",
            rationale: "Invalid",
            observationIds: ["baseline", "second-baseline", "change"],
            derivation: "baseline-change",
            operation: "increase",
          },
        ],
        (id) => id,
      ),
    ).toEqual([]);
  });
});
