import { describe, expect, it } from "vitest";
import { parseResumeSections } from "../../../src/application/parseResumeSections";

/**
 * Smoke checks for local PDF/plain-text fallback parsing (`parseResumeSections`).
 * Narrow assertions only—heavy layout quirks belong in curated fixtures once added.
 */
describe("parseResumeSections (smoke)", () => {
  it("extracts contact fields and routes labeled sections away from generic header blobs", () => {
    const raw = [
      "Ada Lovelace",
      "ada.lovelace@example.com",
      "",
      "Summary",
      "Seasoned engineer who moves metrics with pragmatic delivery beyond eight chars.",
      "",
      "Technical skills",
      "Python, TypeScript",
      "",
      "Experience",
      "MegaCorp",
      "Mar 2020 - Present Melbourne VIC",
      "Principal Engineer Australia",
      "◦ Reduced downtime by seventeen percent quarterly average beyond eight chars.",
      "◦ Introduced Observability dashboards for stakeholder awareness beyond eight chars.",
    ].join("\n");

    const parsed = parseResumeSections(raw);

    expect(parsed.basicInfoFields.email ?? "").toBe("ada.lovelace@example.com");
    expect((parsed.summary ?? "").toLowerCase()).toContain("seasoned engineer");
    expect((parsed.skills ?? "").toLowerCase()).toContain("python");
    expect((parsed.experience ?? "").toLowerCase()).toContain("megacorp");
    expect(parsed.experienceItems.length).toBeGreaterThanOrEqual(1);
    expect((parsed.experience ?? "").toLowerCase()).toContain("reduced downtime");
  });

  it("normalizes Windows newlines and bullet glyphs before section detection", () => {
    const raw = "Name Person\r\nname@example.com\r\n\r\nSkills\r\n• SQL\r\n• REST services";
    const parsed = parseResumeSections(raw);
    expect(parsed.basicInfoFields.email).toBe("name@example.com");
    expect((parsed.skills ?? "").toLowerCase()).toContain("sql");
  });
});
