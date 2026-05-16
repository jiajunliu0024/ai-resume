import type { Resume } from "../domain/resume";

export const CURRENT_RESUME_PARSER_VERSION = "resume-parser-v3-local-merge-v1";

/** True when the resume was parsed by AI with fields expected for tailoring flows. */
export function isResumeParsed(resume: Resume): boolean {
  return (
    resume.parseStatus === "parsed" &&
    resume.parserVersion === CURRENT_RESUME_PARSER_VERSION &&
    Boolean(resume.basicInfoFields) &&
    Boolean(resume.experienceItems?.length || resume.educationItems?.length)
  );
}
