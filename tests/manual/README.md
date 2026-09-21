# Manual AI acceptance pack

This pack verifies the production flow with deterministic source facts. Run it through the visible UI at `https://datatale.bizhov.ru`; do not call internal handlers directly.

The repeatable runner is `grounded-flow-acceptance.spec.ts`. It uses one visible Chromium page at a time, accepts `DATATALE_ACCEPTANCE_BASE_URL` for a staging URL, and reads an optional `DATATALE_ACCEPTANCE_ACCESS_CODE` without printing it. Run the fixture controls first, then the browser pack:

```sh
bun tests/manual/validate-fixtures.ts
DATATALE_ACCEPTANCE_BASE_URL=https://datatale.bizhov.ru \
  bunx playwright test --config=tests/manual/playwright.config.ts
```

The runner logs page errors, failed requests, and HTTP 5xx responses. It waits for the report heading and each grounded answer, checks at least one chart for chartable sources, checks the exact canonical absence response, and exercises malformed CSV and unsupported TSV rejection. The pack is a deterministic release subset; the full query-batch, typed-evidence, retry, and fallback contracts remain covered by the Vitest integration suite. It is intentionally not part of the default local test suite and must not be pointed at production until a release owner schedules it.

## Supported-source scenarios

### `regional-sales.csv`

Expected source controls:

- 12 rows, three cities and four months.
- Total revenue: `1,743,000`.
- Total orders: `1,538`.
- Krasnodar revenue: `569,000`; orders: `531`.
- Moscow revenue: `752,000`; orders: `632`.
- April revenue: `478,000`, the highest monthly revenue.
- Vladivostok does not occur in the source.

Questions:

1. `Какая общая выручка и сколько всего заказов?`
2. `Какая выручка и сколько заказов у Краснодара?`
3. `В каком месяце выручка была максимальной?`
4. `Дай информацию по Владивостоку.` — must return the canonical absence response.

### `quoted-products.csv`

Expected source controls:

- Six products and three categories.
- Total units sold: `175`.
- Drinks sold: `59` units.
- The most expensive product is honey at `920`.
- The product name `Чай, жасминовый` must remain one value despite the comma.
- No dairy products occur in the source.

Questions:

1. `Сколько единиц товара продано всего?`
2. `Сколько продано напитков?`
3. `Как называется чай с жасмином?`
4. `Какой товар самый дорогой и сколько он стоит?`
5. `Есть ли молочные продукты?` — must return the canonical absence response.

### `operations-multisheet.xlsx`

Select and analyze each worksheet separately.

`Продажи` controls:

- Six rows.
- Total revenue: `672,000`; total orders: `693`; total returns: `23`.
- Moscow revenue: `405,000`; Kazan revenue: `267,000`.
- March revenue: `247,000`, the highest monthly revenue.

`Поддержка` controls:

- Six rows.
- Total tickets: `500`; resolved tickets: `453`.
- Team Alpha: `270` tickets and `250` resolved.
- Team Beta: `230` tickets and `203` resolved.
- Highest CSAT: `4.8`, Team Alpha in week 3.

Questions for `Продажи`:

1. `Какая общая выручка и какова разница между выручкой Москвы и Казани? Назови обе суммы.`
2. `В каком месяце выручка максимальна?`

Questions for `Поддержка`:

1. `Сколько обращений поступило и сколько решено?`
2. `Сколько обращений решила команда Альфа?`
3. `Где был самый высокий CSAT?`
4. `Сколько обращений было у команды Гамма?` — must return the canonical absence response.

### `shelter-report.txt`

Paste the complete file into the text input.

Expected source controls:

- End state: 10 dogs, 7 cats and 4 parrots; 21 animals in total.
- A veterinarian examined all 7 cats and 6 dogs.
- Total food expense: `31,500` rubles.
- Highest food expense: 16 September, `8,900` rubles.
- The source explicitly has no rabbit, age or income data.

Questions:

1. `Сколько животных было к концу 17 сентября и сколько кошек и собак осмотрел ветеринар?`
2. `Какова общая сумма расходов на корм и в какой день была максимальная сумма? Назови дату и сумму.`
3. `Сколько в приюте кроликов?` — must return the canonical absence response.

### Additional bounded flow fixtures

- `monthly-buckets.csv` has January values `60 + 60` and February value `100`, with equal values under separate revenue and cost fields. It checks monthly date bucketing and field grounding.
- `known-range-zero.csv` contains a known January Moscow range with no February Moscow row. It checks a valid zero count separately from an absent named city.
- `shuffled-dates.txt` lists 14, 15, and 16 September in shuffled order and checks daily chart ordering.
- `animals-without-total.txt` states 10 dogs, 7 cats, and 4 parrots without an explicit total. It checks the bounded grounded `10 + 7 + 4` answer.
- `localized-numbers.txt` contains `1.234,56`, `1 234,56`, and `1'234` evidence forms.

## Rejection scenarios

- `malformed.csv` must show a readable CSV parsing error and must not start analysis.
- `unsupported.tsv` must be rejected as an unsupported format and must not start analysis.

## Acceptance criteria

For every supported source:

- analysis completes without an error;
- displayed metrics and narrative do not contradict the controls above;
- at least one meaningful chart is rendered when the source supports a comparison or trend;
- every factual chat response is grounded in the selected source;
- the absent-fact question returns `В этом отчете нет такой информации`;
- replacing the source clears the previous report and chat evidence.
