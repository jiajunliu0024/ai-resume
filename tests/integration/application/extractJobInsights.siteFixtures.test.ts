import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractJobInsights } from "../../../src/application/extractJobInsights";

/**
 * Offline, site-shaped fixtures: company names, locations, and full JD copy are fictional—not scraped from live listings.
 * They regression-test `extractBasicJobIdentity` (title/employer line), section headings, and the technical keyword list on fixed text
 * so CI can catch parser changes without touching production code. Expected `jobTitle` / `company` values reflect **current** heuristics,
 * not an ideal HR taxonomy (multi-word titles are a known edge case for the first-line regex).
 */

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/job-descriptions");

function loadJdFixture(file: string): string {
  return readFileSync(join(fixturesDir, file), "utf8");
}

describe("extractJobInsights (site-inspired fixtures)", () => {
  /**
   * Uses `seek-au-style.txt`: headline like common AU job drawers—title, employer, then `Posted <date>` on the first row.
   * Asserts: (1) `jobTitle` / `company` match the current regex (including the quirk where a two-word role may leave the second word in `company`);
   * (2) body text hits `technicalKeywordPatterns`; (3) a `requirements`-style section yields at least one requirement; (4) confidence is in the “structured content found” band.
   */
  it("parses SEEK-style title / company when `Posted <date>` is on the headline row", () => {
    const raw = loadJdFixture("seek-au-style.txt");
    const out = extractJobInsights(raw);

    expect(out.jobTitle).toBe("Data");
    expect(out.company).toBe("Engineer Alpine Labs Pty Ltd");
    expect(out.keywords.map((k) => k.text).sort()).toEqual(
      [
        "Business Analysis",
        "OData",
        "REST",
        "Robotic Process Automation",
        "SQL Server",
        "Web Services",
      ].sort(),
    );
    expect(out.confidence).toBeGreaterThanOrEqual(0.65);
    expect(out.requirements.length).toBeGreaterThanOrEqual(1);
    expect(out.requirements.some((r) => r.text.toLowerCase().includes("cross-functional"))).toBe(true);
  });

  /**
   * Uses `indeed-like-posted-line.txt`: a single headline line with role, company, and `Posted`, similar to aggregator / Indeed-style layouts.
   * A one-word role (“Chemist”) avoids multi-word regex ambiguity. Asserts parsed company, at least one keyword, and confidence above the “empty JD” tier.
   */
  it("parses Indeed-like headline when Posted date sits on first line after title + employer", () => {
    const raw = loadJdFixture("indeed-like-posted-line.txt");
    const out = extractJobInsights(raw);

    expect(out.jobTitle).toBe("Chemist");
    expect(out.company).toBe("Alpine Health Co");
    expect(out.keywords.length).toBeGreaterThanOrEqual(1);
    expect(out.confidence).toBeGreaterThanOrEqual(0.65);
  });

  /**
   * Uses `linkedin-ish-no-posted-date.txt`: multi-line title, bullet-style metadata with middots, `about the role` / `experience`
   * sections, and **no** Posted line. Focus: long-form sentences under headings like `experience` still become requirements;
   * `REST` and `Prompt Engineering` match keywords; `jobTitle` is validated by substring (`platform engineer iii`) because identity is fully heuristic without `Posted`.
   */
  it("handles LinkedIn-shaped plain text when no Posted banner (requirements + REST keyword still surface)", () => {
    const raw = loadJdFixture("linkedin-ish-no-posted-date.txt");
    const out = extractJobInsights(raw);

    expect(out.requirements.length).toBeGreaterThanOrEqual(1);
    expect(out.keywords.some((k) => k.text === "REST")).toBe(true);
    expect(out.keywords.some((k) => k.text === "Prompt Engineering")).toBe(true);
    expect(normalizeJoined(out.jobTitle ?? "")).toContain("platform engineer iii");
    expect(out.confidence).toBeGreaterThanOrEqual(0.65);
  });
});

/** Collapses whitespace and lowercases `jobTitle` for stable substring checks when the extractor joins multiple fragments. */
function normalizeJoined(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
