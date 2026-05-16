import { describe, expect, it } from "vitest";
import { extractJobInsights } from "../../../src/application/extractJobInsights";

/**
 * Fast deterministic checks on `extractJobInsights` without reading disk fixtures.
 * Site-shaped scenarios live in `extractJobInsights.siteFixtures.test.ts`.
 */
describe("extractJobInsights (unit)", () => {
  it("returns low confidence and empty requirement lists for empty input", () => {
    const out = extractJobInsights("");
    expect(out.requirements).toEqual([]);
    expect(out.keywords).toEqual([]);
    expect(out.confidence).toBe(0.25);
    expect(out.company).toBeUndefined();
  });

  it("flags higher confidence once technical keywords appear even without headings", () => {
    const out = extractJobInsights("Snippet mentions REST endpoints only.");
    expect(out.keywords.some((keyword) => keyword.text === "REST")).toBe(true);
    expect(out.confidence).toBeGreaterThanOrEqual(0.65);
    expect(out.requirements).toEqual([]);
  });

  it("mines requirement sentences after known headings reach minimum character length", () => {
    const text = [
      "about the role",
      "Maintain automation pipelines with SOAP integrations and stakeholder communication cadence exceeding minimum length thresholds.",
    ].join("\n");

    const out = extractJobInsights(text);
    expect(out.requirements.length).toBeGreaterThanOrEqual(1);
    expect(out.requirements[0]?.text.toLowerCase()).toContain("automation pipelines");
    expect(out.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it("captures overlapping keyword categories without duplication beyond pattern matches", () => {
    const out = extractJobInsights("Comfortable with OData and Prompt Engineering mentorship.");
    const keywordTexts = out.keywords.map((keyword) => keyword.text).sort();
    expect(keywordTexts).toEqual(["OData", "Prompt Engineering"].sort());
  });
});
