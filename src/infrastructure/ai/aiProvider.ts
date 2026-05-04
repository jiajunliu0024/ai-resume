import { type CoverLetter } from "../../domain/coverLetter";
import { type JobDescription } from "../../domain/jobDescription";
import { type Resume, type ResumeRewriteSuggestion } from "../../domain/resume";

export type AiProvider = {
  extractJobDescription(rawText: string): Promise<JobDescription>;
  generateResumeSuggestions(input: {
    jobDescription: JobDescription;
    resume: Resume;
  }): Promise<ResumeRewriteSuggestion[]>;
  generateCoverLetter(input: {
    jobDescription: JobDescription;
    resume: Resume;
  }): Promise<CoverLetter>;
};
