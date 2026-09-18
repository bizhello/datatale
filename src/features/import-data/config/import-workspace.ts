import type { Dataset } from "@/entities/dataset";

export const demoTable = {
  headers: ["Месяц", "Выручка", "Заказы"],
  rows: [
    ["Январь", "128000", "120"],
    ["Февраль", "146000", "132"],
    ["Март", "171000", "156"],
    ["Апрель", "163000", "149"],
  ],
};

export const demoText =
  "Месяц,Выручка,Заказы\nЯнварь,128000,120\nФевраль,146000,132\nМарт,171000,156\nАпрель,163000,149";

export const scalarTypeLabel: Record<
  Dataset["columns"][number]["scalarType"],
  string
> = {
  string: "Текст",
  number: "Число",
  date: "Дата",
  boolean: "Да/нет",
};
