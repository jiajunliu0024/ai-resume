import { describe, expect, it } from "vitest";
import { listResumeChunksForCoverLetter } from "../../../src/application/listResumeChunksForCoverLetter";
import type { Resume } from "../../../src/domain/resume";

/** Covers cover-letter chunk listing: null guard, overlapping structured vs parsed resume fields. */

function minimalResume(overrides: Partial<Resume>): Resume {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "resume-unit",
    title: "Unit resume",
    rawText: overrides.rawText ?? "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("listResumeChunksForCoverLetter", () => {
  it("returns an empty list when resume input is absent", () => {
    expect(listResumeChunksForCoverLetter(null)).toEqual([]);
  });

  it("emits ordered chunks combining structured fields plus parsed fallbacks", () => {
    const resume = minimalResume({
      rawText: [
        "Pat Example",
        "pat.example@labs.test",
        "",
        "Summary",
        "Builder with eight plus chars of credible narrative.",
        "",
        "Experience",
        "TinyCo",
        "Jan 2021 - Present",
        "Senior Builder",
        "◦ Owned migrations that exceed eight chars each week.",
      ].join("\n"),
      skills: "- SQL\n- Observability tooling",
      experienceItems: [
        {
          id: "experience-legacy",
          title: "Contract IC",
          company: "TinyCo",
          dates: "2019 — 2020",
          location: "Remote",
          achievements: [],
        },
      ],
    });

    const chunks = listResumeChunksForCoverLetter(resume);
    expect(chunks[0]?.id).toBe("resume-basic");
    expect(chunks[0]?.body).toContain("pat.example@labs.test");

    expect(chunks.find((chunk) => chunk.id === "resume-summary")).toMatchObject({
      label: "Professional summary",
    });

    expect(chunks.find((chunk) => chunk.id === "resume-skills")?.body).toContain("SQL");

    expect(chunks.some((chunk) => chunk.id === "resume-exp-experience-legacy")).toBe(true);
  });

  it("surfaces certifications parsed from raw text when the resume omits curated certification fields", () => {
    const resume = minimalResume({
      rawText: [
        "Dev Person",
        "dev@corp.test",
        "",
        "certifications",
        "Kubernetes Administrator credential code ABC123EXTRA",
      ].join("\n"),
    });

    const chunks = listResumeChunksForCoverLetter(resume);
    expect(chunks.some((chunk) => chunk.id === "resume-certifications")).toBe(true);
    expect(
      chunks.find((chunk) => chunk.id === "resume-certifications")?.body ?? "",
    ).toMatch(/Kubernetes/u);
  });
});
