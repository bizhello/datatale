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
});
