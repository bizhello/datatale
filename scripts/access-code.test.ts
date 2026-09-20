import { describe, expect, it } from "vitest";
import { accessCodeOutput } from "./access-code";

const seed = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc";

describe("access code command", () => {
  it("prints only today's code and its UTC expiry", () => {
    const output = accessCodeOutput(seed, new Date("2026-09-19T15:00:00.000Z"));
    expect(output).toBe(
      "DT-20260919-wbWaHvxnm_FWI8XuwSaR1A\nExpires: 2026-09-20T00:00:00.000Z (UTC)",
    );
    expect(output).not.toContain(seed);
  });

  it("rejects missing and weak seed configuration", () => {
    expect(() => accessCodeOutput(undefined)).toThrow(
      "ANALYSIS_INVITE_CODE_SEED",
    );
    expect(() => accessCodeOutput("weak")).toThrow("ANALYSIS_INVITE_CODE_SEED");
  });
});
