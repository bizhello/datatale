import { describe, expect, it } from "vitest";
import { labelMentionedInQuestion } from "./label-match";

describe("column label matching", () => {
  it.each([
    ["Выручка", "Какова сумма выручки?"],
    ["Заказы", "Сколько заказов?"],
    ["Доход", "Какова сумма доходов?"],
  ])("matches Russian noun inflections: %s", (label, question) => {
    expect(labelMentionedInQuestion(label, question)).toBe(true);
  });

  it.each([
    ["Доход", "Какова средняя доходность?"],
    ["Заказы", "Какова сумма заказчиков?"],
    ["Прибыль", "Во сколько прибыл заказ?"],
    ["Прибыль", "Во сколько прибыли поезда?"],
    ["Убыль", "На сколько убыл запас?"],
    ["Убыль", "На сколько убыли запасы?"],
    ["Дата", "Сколько нужно дать?"],
    ["Такси", "Какова средняя такса?"],
  ])("rejects a derived word with another meaning: %s", (label, question) => {
    expect(labelMentionedInQuestion(label, question)).toBe(false);
  });
});
