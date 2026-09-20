import type { Dataset } from "@/entities/dataset";

export const scalarTypeLabel: Record<
  Dataset["columns"][number]["scalarType"],
  string
> = {
  string: "Текст",
  number: "Число",
  date: "Дата",
  boolean: "Да/нет",
};
