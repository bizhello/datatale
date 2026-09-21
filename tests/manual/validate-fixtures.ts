import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";

const directory = path.join(process.cwd(), "tests/manual/fixtures");
const text = async (name: string) =>
  readFile(path.join(directory, name), "utf8");

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

console.log("Manual acceptance fixtures passed local control checks.");
