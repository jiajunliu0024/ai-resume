import { describe, expect, it } from "vitest";
import {
  CURRENT_RESUME_PARSER_VERSION,
  isResumeParsed,
} from "../../../src/application/resumeParseStatus";
import type {
  Resume,
  ResumeEducationItem,
  ResumeExperienceItem,
} from "../../../src/domain/resume";

const sampleBasicFields = (): NonNullable<Resume["basicInfoFields"]> => ({
  name: "Pat Example",
  email: "pat@example.com",
  phone: "",
  location: "",
  links: [],
});

const sampleExperience = (): ResumeExperienceItem => ({
  id: "exp-1",
  title: "Engineer",
  company: "Contoso",
  dates: "",
  location: "",
  achievements: [],
});

const sampleEducation = (): ResumeEducationItem => ({
  id: "edu-1",
  degree: "Bachelor of Testing",
  school: "Example University",
  dates: "",
  details: "",
});

/** Minimal resume for predicates that only read parse metadata + structured slices. */
function baseResume(overrides: Partial<Resume>): Resume {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "resume-id",
    title: "Résumé",
    rawText: "placeholder",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("isResumeParsed", () => {
  it("returns true when AI parsing succeeded at the active parserVersion with basics + experience", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "parsed",
          parserVersion: CURRENT_RESUME_PARSER_VERSION,
          basicInfoFields: sampleBasicFields(),
          experienceItems: [sampleExperience()],
        }),
      ),
    ).toBe(true);
  });

  it("returns true when only education entries exist under the same gates", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "parsed",
          parserVersion: CURRENT_RESUME_PARSER_VERSION,
          basicInfoFields: sampleBasicFields(),
          educationItems: [sampleEducation()],
        }),
      ),
    ).toBe(true);
  });

  it("returns false for local fallback even if buckets look populated", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "fallback",
          parserVersion: CURRENT_RESUME_PARSER_VERSION,
          basicInfoFields: sampleBasicFields(),
          experienceItems: [sampleExperience()],
        }),
      ),
    ).toBe(false);
  });

  it("returns false when parserVersion drifts", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "parsed",
          parserVersion: "legacy-parser-v0",
          basicInfoFields: sampleBasicFields(),
          experienceItems: [sampleExperience()],
        }),
      ),
    ).toBe(false);
  });

  it("returns false without basicInfoFields", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "parsed",
          parserVersion: CURRENT_RESUME_PARSER_VERSION,
          experienceItems: [sampleExperience()],
        }),
      ),
    ).toBe(false);
  });

  it("returns false without experienceItems or educationItems", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "parsed",
          parserVersion: CURRENT_RESUME_PARSER_VERSION,
          basicInfoFields: sampleBasicFields(),
        }),
      ),
    ).toBe(false);
  });

  it("returns false when both lists are explicitly empty arrays", () => {
    expect(
      isResumeParsed(
        baseResume({
          parseStatus: "parsed",
          parserVersion: CURRENT_RESUME_PARSER_VERSION,
          basicInfoFields: sampleBasicFields(),
          experienceItems: [],
          educationItems: [],
        }),
      ),
    ).toBe(false);
  });
});
