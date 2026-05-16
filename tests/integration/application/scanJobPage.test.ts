import { describe, expect, it } from "vitest";
import { extractJobInsights } from "../../../src/application/extractJobInsights";
import { scanJobPage } from "../../../src/application/scanJobPage";

/**
 * Synthetic JD where the local `extractJobInsights` path yields a non-empty `company` string
 * (heuristic; not canonical job-title or employer names from a real ATS).
 */
const JD_WITH_COMPANY =
  "Data Engineer    MegaCorp    Posted 2 May 2026\nAbout the role. Deliver APIs using REST.";

/**
 * `scanJobPage` runs `pageText` through the local extractor and merges that with page metadata
 * into the scan payload. These tests cover merge and passthrough behaviour only—not OpenAI or site DOMs.
 */
describe("scanJobPage", () => {
  /**
   * When the local extractor infers an employer string, `company` on the scan result must match
   * `extractJobInsights` and must not be hard-coded to `Unknown company`. Also assert no leading/trailing whitespace.
   */
  it("merges employer from local extractJobInsights (no longer hard-coded Unknown company)", () => {
    const insights = extractJobInsights(JD_WITH_COMPANY);
    expect(insights.company, "fixture must yield a parsed company").toBeTruthy();

    const scanned = scanJobPage({
      sourceUrl: "https://example.com/jobs/1",
      pageTitle: "Job — Example Site",
      pageText: JD_WITH_COMPANY,
    });

    expect(scanned.company).toEqual(insights.company);
    expect(scanned.company.trim()).toBe(scanned.company);
  });

  /**
   * Empty `pageText` yields nothing for the extractor to parse; `company` must fall back to `Unknown company`.
   */
  it("falls back to Unknown company when JD text is empty", () => {
    const scanned = scanJobPage({
      sourceUrl: "https://example.com/blank",
      pageTitle: "Blank tab",
      pageText: "",
    });

    expect(scanned.company).toBe("Unknown company");
  });

  /**
   * Whitespace-only input (spaces, newlines, tabs, NBSP) should be treated like an empty JD and still map to `Unknown company`.
   */
  it("falls back to Unknown company when JD text is only whitespace", () => {
    const scanned = scanJobPage({
      sourceUrl: "https://example.com/ws",
      pageTitle: "Whitespace",
      pageText: "  \n\t  \u00a0 ",
    });

    expect(scanned.company).toBe("Unknown company");
  });

  /**
   * Scan must not rewrite caller-provided page metadata: `title` ← `pageTitle`, `rawText` ← `pageText`,
   * and optional `debugLog` is echoed unchanged when present.
   */
  it("passes through pageTitle, sourceUrl, rawText, optional debugLog unchanged", () => {
    const input = {
      sourceUrl: "https://jobs.example/acme/backend",
      pageTitle: "Backend Engineer | Acme",
      pageText: "Short posting without Posted line header.",
      debugLog: "tab=123|chars=420",
    };
    const scanned = scanJobPage(input);

    expect(scanned.title).toBe(input.pageTitle);
    expect(scanned.sourceUrl).toBe(input.sourceUrl);
    expect(scanned.rawText).toBe(input.pageText);
    expect(scanned.debugLog).toBe(input.debugLog);
  });

  /**
   * `requirements`, `keywords`, and `confidence` from the local extractor must appear on the scan result as-is
   * so the UI can show them before any AI enrichment replaces them.
   */
  it("forwards requirements, keywords, and confidence from extractJobInsights", () => {
    const insights = extractJobInsights(JD_WITH_COMPANY);
    const scanned = scanJobPage({
      sourceUrl: "https://example.com/",
      pageTitle: "Ignored for this assertion",
      pageText: JD_WITH_COMPANY,
    });

    expect(scanned.requirements).toEqual(insights.requirements);
    expect(scanned.keywords).toEqual(insights.keywords);
    expect(scanned.confidence).toBe(insights.confidence);
  });

  /**
   * Treat `scanJobPage` as non-mutating: the `input` object and its fields must be unchanged after the call
   * so React/caller state is not accidentally corrupted.
   */
  it("does not mutate the input object", () => {
    const input = {
      sourceUrl: "https://immutable.example/",
      pageTitle: "Title",
      pageText: JD_WITH_COMPANY,
    };
    const copy = structuredClone(input);
    scanJobPage(input);

    expect(input).toEqual(copy);
  });

  /**
   * Merge logic trims `insights.company`; when the extractor returns a company, `scanned.company` must have no outer whitespace
   * and must equal the trimmed value from `extractJobInsights`.
   */
  it("trims inferred company whitespace before emitting", () => {
    const insights = extractJobInsights(JD_WITH_COMPANY);
    expect(insights.company).toBeTruthy();

    const scanned = scanJobPage({
      sourceUrl: "https://example.com/",
      pageTitle: "T",
      pageText: JD_WITH_COMPANY,
    });

    expect(scanned.company?.length).toBeGreaterThan(0);
    expect(scanned.company).toBe(insights.company?.trim());
    expect(scanned.company).not.toMatch(/^\s|\s$/);
  });
});
