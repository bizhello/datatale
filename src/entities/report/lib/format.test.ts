import { describe, expect, it } from "vitest";
import { formatChartAxisValue } from "./format";

describe("formatChartAxisValue", () => {
  it("keeps small values readable and compacts values that would overflow the axis", () => {
    expect(formatChartAxisValue(9500)).toBe("9 500");
    expect(formatChartAxisValue(353_185_060.81)).toBe("353,2 млн");
    expect(formatChartAxisValue(-12_500)).toBe("-12,5 тыс.");
  });
});
