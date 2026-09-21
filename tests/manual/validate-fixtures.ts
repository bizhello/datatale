import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readXlsxFile from "read-excel-file/node";

const directory = path.join(process.cwd(), "tests/manual/fixtures");
const text = async (name: string) =>
  readFile(path.join(directory, name), "utf8");
const grouping = "[\\s\\u00a0\\u202f.,'’]*";
const numberPattern = (value: number) => {
  const [whole = "", fraction] = String(value).split(".");
  const wholePattern = whole.split("").join(grouping);
  const fractionPattern = fraction
    ? `[.,]${fraction.split("").join(grouping)}`
    : "";
  return new RegExp(
    `(?<![\\p{L}\\d])${wholePattern}${fractionPattern}(?![\\p{L}\\d])`,
    "u",
  );
};

assert.match("1 234,56", numberPattern(1_234.56));
assert.match("1.234,56", numberPattern(1_234.56));
assert.match("247 000", numberPattern(247_000));
assert.doesNotMatch("120", numberPattern(0));

const regional = await text("regional-sales.csv");
assert.equal(regional.trim().split("\n").length, 13);
assert.match(regional, /2026-04-01,Краснодар,Партнеры,157000,145,3/);

const monthly = await text("monthly-buckets.csv");
assert.equal(monthly.trim().split("\n").length, 4);
assert.match(monthly, /2026-01-02,Москва,60,60,1/);
assert.match(monthly, /2026-01-31,Москва,60,60,2/);
assert.match(monthly, /2026-02-01,Москва,100,100,3/);

const knownRange = await text("known-range-zero.csv");
assert.equal(knownRange.trim().split("\n").length, 4);
assert.match(knownRange, /2026-01-01,Москва,4/);
assert.match(knownRange, /2026-02-01,Казань,3/);

const quoted = await text("quoted-products.csv");
assert.match(quoted, /"Чай, жасминовый"/);

const shuffled = await text("shuffled-dates.txt");
for (const date of ["14 сентября", "15 сентября", "16 сентября"])
  assert.match(shuffled, new RegExp(date));

const animals = await text("animals-without-total.txt");
for (const quantity of ["10 собак", "7 кошек", "4 попугая"])
  assert.match(animals, new RegExp(quantity));
assert.doesNotMatch(animals, /21\s+животн/u);

const localized = await text("localized-numbers.txt");
for (const number of ["1.234,56", "1 234,56", "1'234"])
  assert.match(localized, new RegExp(number.replace("'", "['’]")));

const sheets = await readXlsxFile(
  path.join(directory, "operations-multisheet.xlsx"),
);
assert.deepEqual(
  sheets.map(({ sheet }) => sheet),
  ["Продажи", "Поддержка"],
);
const salesRows = sheets[0]?.data.slice(1) ?? [];
assert.equal(
  salesRows.reduce((total, row) => total + Number(row[3]), 0),
  672_000,
);
assert.equal(
  salesRows.reduce((total, row) => total + Number(row[4]), 0),
  693,
);
assert.equal(
  salesRows
    .filter((row) => row[1] === "Москва")
    .reduce((total, row) => total + Number(row[3]), 0),
  405_000,
);
assert.equal(
  salesRows
    .filter((row) => row[1] === "Казань")
    .reduce((total, row) => total + Number(row[3]), 0),
  267_000,
);
assert.equal(
  salesRows
    .filter((row) => row[0] instanceof Date && row[0].getUTCMonth() === 2)
    .reduce((total, row) => total + Number(row[3]), 0),
  247_000,
);
const supportRows = sheets[1]?.data.slice(1) ?? [];
assert.equal(
  supportRows.reduce((total, row) => total + Number(row[2]), 0),
  500,
);
assert.equal(
  supportRows.reduce((total, row) => total + Number(row[3]), 0),
  453,
);
assert.equal(
  supportRows
    .filter((row) => row[1] === "Альфа")
    .reduce((total, row) => total + Number(row[3]), 0),
  250,
);
assert.equal(
  supportRows
    .filter((row) => row[1] === "Альфа")
    .reduce((total, row) => total + Number(row[2]), 0),
  270,
);
assert.equal(Math.max(...supportRows.map((row) => Number(row[4]))), 4.8);

console.log("Manual acceptance fixtures passed local control checks.");
