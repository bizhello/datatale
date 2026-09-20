export const showcaseDemoFilename = "demo.csv";

export const showcaseDemoTable = {
  headers: ["Месяц", "Выручка", "Заказы"],
  rows: [
    ["Январь", "128000", "120"],
    ["Февраль", "146000", "132"],
    ["Март", "171000", "156"],
    ["Апрель", "163000", "149"],
  ],
};

export const showcaseDemoText = [
  showcaseDemoTable.headers,
  ...showcaseDemoTable.rows,
]
  .map((row) => row.join(","))
  .join("\n");
