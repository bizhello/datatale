# Manual AI acceptance pack

This pack verifies the production flow with deterministic source facts. Run it through the visible UI at `https://datatale.bizhov.ru`; do not call internal handlers directly.

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
2. `Сколько выручки и заказов у Краснодара?`
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
3. `Какой товар самый дорогой?`
4. `Есть ли в данных молочные продукты?` — must return the canonical absence response.

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

1. `Какая общая выручка?`
2. `Сравни выручку Москвы и Казани.`
3. `В каком месяце выручка максимальна?`
4. `Какая выручка у Самары?` — must return the canonical absence response.

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

1. `Сколько животных было в приюте к концу 17 сентября?`
2. `Сколько кошек осмотрел ветеринар?`
3. `В какой день расходы на корм были максимальными и сколько они составили?`
4. `Сколько в приюте кроликов?` — must return the canonical absence response.

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
