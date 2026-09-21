import { describe, expect, it } from "vitest";
import { validateAnswerReferences } from "./answer-validation";

const evidence = new Map([
  [
    "april",
    {
      id: "april",
      excerpt: "Группа 2026-04-01; значение 478000.",
      numericValues: [478_000],
      isoDates: ["2026-04-01"],
    },
  ],
]);

describe("localized date evidence", () => {
  it("accepts a localized month and year backed by a cited ISO date", () => {
    expect(
      validateAnswerReferences(
        "Максимальная выручка была в апреле 2026 года — 478 000.",
        [{ id: "april" }],
        evidence,
      ),
    ).toEqual([
      { id: "april", excerpt: "Группа 2026-04-01; значение 478000." },
    ]);
  });

  it("rejects a localized month absent from the cited date", () => {
    expect(() =>
      validateAnswerReferences(
        "Максимальная выручка была в мае 2026 года — 478 000.",
        [{ id: "april" }],
        evidence,
      ),
    ).toThrow(/date absent/i);
  });

  it("accepts a Russian date quoted by a cited text paragraph", () => {
    const textEvidence = new Map([
      [
        "paragraph-3",
        {
          id: "paragraph-3",
          excerpt:
            "К концу 17 сентября в приюте находились 10 собак, 7 кошек и 4 попугая — всего 21 животное.",
          numericValues: [17, 10, 7, 4, 21],
        },
      ],
    ]);

    expect(
      validateAnswerReferences(
        "К концу 17 сентября в приюте было 21 животное.",
        [{ id: "paragraph-3" }],
        textEvidence,
      ),
    ).toEqual([
      {
        id: "paragraph-3",
        excerpt:
          "К концу 17 сентября в приюте находились 10 собак, 7 кошек и 4 попугая — всего 21 животное.",
      },
    ]);
  });

  it("rejects a Russian date absent from the cited text paragraph", () => {
    const textEvidence = new Map([
      [
        "paragraph-3",
        {
          id: "paragraph-3",
          excerpt: "К концу 17 сентября в приюте было 21 животное.",
          numericValues: [17, 21],
        },
      ],
    ]);

    expect(() =>
      validateAnswerReferences(
        "К концу 18 сентября в приюте было 21 животное.",
        [{ id: "paragraph-3" }],
        textEvidence,
      ),
    ).toThrow(/date absent/i);
  });

  it("accepts an ISO answer date backed by a Russian cited date", () => {
    const textEvidence = new Map([
      [
        "paragraph-1",
        {
          id: "paragraph-1",
          excerpt: "Событие произошло 17 сентября 2026 года.",
          numericValues: [17, 2026],
        },
      ],
    ]);

    expect(() =>
      validateAnswerReferences(
        "Дата: 2026-09-17.",
        [{ id: "paragraph-1" }],
        textEvidence,
      ),
    ).not.toThrow();
  });

  it("does not treat a word beginning with ма as May evidence", () => {
    const textEvidence = new Map([
      [
        "paragraph-1",
        {
          id: "paragraph-1",
          excerpt: "В отчёте описан маятник.",
          numericValues: [],
        },
      ],
    ]);

    expect(() =>
      validateAnswerReferences(
        "Событие было в мае.",
        [{ id: "paragraph-1" }],
        textEvidence,
      ),
    ).toThrow(/date absent/i);
  });

  it("validates both ends of a Russian date range", () => {
    const unrelatedNumbers = new Map([
      [
        "paragraph-1",
        {
          id: "paragraph-1",
          excerpt: "14 заявок зарегистрировали 17 сентября.",
          numericValues: [14, 17],
        },
      ],
    ]);
    const dateRange = new Map([
      [
        "paragraph-1",
        {
          id: "paragraph-1",
          excerpt: "Отчёт охватывает 14–17 сентября.",
          numericValues: [14, 17],
        },
      ],
    ]);

    expect(() =>
      validateAnswerReferences(
        "Период: с 14 по 17 сентября.",
        [{ id: "paragraph-1" }],
        unrelatedNumbers,
      ),
    ).toThrow(/date absent/i);
    expect(() =>
      validateAnswerReferences(
        "Период: с 14 по 17 сентября.",
        [{ id: "paragraph-1" }],
        dateRange,
      ),
    ).not.toThrow();
  });
});
