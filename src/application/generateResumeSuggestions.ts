import { type JobDescription } from "../domain/jobDescription";
import { type Resume, type ResumeRewriteSuggestion } from "../domain/resume";

export type GenerateResumeSuggestionsInput = {
  jobDescription: JobDescription;
  resume: Resume;
};

export type GenerateResumeSuggestionsResult = {
  suggestions: ResumeRewriteSuggestion[];
};

export async function generateResumeSuggestions(
  _input: GenerateResumeSuggestionsInput,
): Promise<GenerateResumeSuggestionsResult> {
  return {
    suggestions: [],
  };
}
