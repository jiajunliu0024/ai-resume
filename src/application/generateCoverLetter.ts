import { type CoverLetter } from "../domain/coverLetter";
import { type JobDescription } from "../domain/jobDescription";
import { type Resume } from "../domain/resume";

export type GenerateCoverLetterInput = {
  jobDescription: JobDescription;
  resume: Resume;
};

export async function generateCoverLetter(
  _input: GenerateCoverLetterInput,
): Promise<CoverLetter> {
  return {
    id: crypto.randomUUID(),
    content: "",
    createdAt: new Date().toISOString(),
  };
}
