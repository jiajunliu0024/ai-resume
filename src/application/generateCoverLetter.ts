import { type CoverLetter } from "../domain/coverLetter";
import { type ScanJobPageResult } from "./scanJobPage";
import { type Resume } from "../domain/resume";
import { type AiProviderId } from "../infrastructure/ai/openAiJobInsightsExtractor";
import { generateCoverLetterWithAiProvider } from "../infrastructure/ai/openAiCoverLetterGenerator";
import { listResumeChunksForCoverLetter } from "./listResumeChunksForCoverLetter";

export type GenerateCoverLetterInput = {
  job: ScanJobPageResult;
  resume: Resume;
  selectedKeywordIds: ReadonlySet<string>;
  selectedRequirementIds: ReadonlySet<string>;
  selectedResumeChunkIds: ReadonlySet<string>;
  apiKey: string;
  providerId: AiProviderId;
};

export async function generateCoverLetter(input: GenerateCoverLetterInput): Promise<CoverLetter> {
  const {
    job,
    resume,
    selectedKeywordIds,
    selectedRequirementIds,
    selectedResumeChunkIds,
    apiKey,
    providerId,
  } = input;

  const keywordLines = job.keywords
    .filter((k) => selectedKeywordIds.has(k.id))
    .map((k) => k.text.trim())
    .filter(Boolean);

  const requirementLines = job.requirements
    .filter((r) => selectedRequirementIds.has(r.id))
    .map((r) => r.text.trim())
    .filter(Boolean);

  const chunkOptions = listResumeChunksForCoverLetter(resume);
  const resumeBlocks = chunkOptions
    .filter((c) => selectedResumeChunkIds.has(c.id))
    .map((c) => ({ heading: c.label, body: c.body }));

  const letter = await generateCoverLetterWithAiProvider({
    jobTitle: job.title.trim() || "Role",
    company: job.company.trim() || "Company",
    jdSnippet: job.rawText.slice(0, 6000),
    keywordLines,
    requirementLines,
    resumeBlocks,
    apiKey,
    providerId,
  });

  return {
    id: crypto.randomUUID(),
    content: letter,
    createdAt: new Date().toISOString(),
  };
}
