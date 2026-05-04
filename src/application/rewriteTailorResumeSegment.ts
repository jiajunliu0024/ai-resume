import { type AiProviderId } from "../infrastructure/ai/openAiJobInsightsExtractor";
import {
  rewriteTailorResumeSegment as rewriteTailorResumeSegmentInfra,
  type TailorSegmentRewriteOutcome,
  type TailorSelectedRequirement,
} from "../infrastructure/ai/tailorSegmentRewriter";

export type { TailorSegmentRewriteOutcome, TailorSelectedRequirement };

export async function rewriteTailorResumeSegment(input: {
  originalText: string;
  selectedKeywords: string[];
  selectedRequirements: TailorSelectedRequirement[];
  apiKey: string;
  providerId: AiProviderId;
}): Promise<TailorSegmentRewriteOutcome> {
  return rewriteTailorResumeSegmentInfra(input);
}

export {
  countWords,
  TAILOR_REWRITE_WORD_MARGIN,
} from "../infrastructure/ai/tailorSegmentRewriter";
