import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { createMultiSheetXlsx } from "../../../../tests/fixtures/import/xlsx";

describe("XLSX workbook fixture", () => {
  it("is a real workbook with independently selectable sheets", async () => {
    const bytes = createMultiSheetXlsx();
    await expect(readSheet(Buffer.from(bytes), "Продажи")).resolves.toEqual([
      ["Месяц", "Заказы"],
      ["Январь", "12"],
    ]);
    await expect(readSheet(Buffer.from(bytes), "Заметки")).resolves.toEqual([
      ["Раздел", "Текст"],
      ["Итог", "Готово"],
    ]);
  });
});
