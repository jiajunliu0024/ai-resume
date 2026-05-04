import type { RequirementCategory } from "../../domain/jobDescription";
import {
  getAiProviderChatCompletionConfig,
  type AiProviderId,
} from "./openAiJobInsightsExtractor";

/** Allowed deviation from original word count (each side), used in UI + prompt. */
export const TAILOR_REWRITE_WORD_MARGIN = 20;

export type TailorSelectedRequirement = {
  text: string;
  category: RequirementCategory;
};

function partitionRequirements(items: TailorSelectedRequirement[]) {
  const tenureCredentials: string[] = [];
  const requirementSkills: string[] = [];
  const softContext: string[] = [];

  for (const item of items) {
    const line = item.text.trim();
    if (!line) {
      continue;
    }

    if (item.category === "experience" || item.category === "qualification") {
      tenureCredentials.push(line);
    } else if (item.category === "skill" || item.category === "tool") {
      requirementSkills.push(line);
    } else if (item.category === "responsibility" || item.category === "other") {
      softContext.push(line);
    } else {
      requirementSkills.push(line);
    }
  }

  return { tenureCredentials, requirementSkills, softContext };
}

/** Outcome of a segment rewrite; always includes the request body for debugging (no API key in body). */
export type TailorSegmentRewriteOutcome =
  | {
      ok: true;
      rewritten: string;
      requestJson: Record<string, unknown>;
      /** Full chat/completions JSON from the provider. */
      responseJson: unknown;
    }
  | {
      ok: false;
      message: string;
      requestJson: Record<string, unknown>;
      responseJson?: unknown;
    };

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export async function rewriteTailorResumeSegment(input: {
  originalText: string;
  selectedKeywords: string[];
  selectedRequirements: TailorSelectedRequirement[];
  apiKey: string;
  providerId: AiProviderId;
}): Promise<TailorSegmentRewriteOutcome> {
  const { originalText, selectedKeywords, selectedRequirements, apiKey, providerId } = input;
  const provider = getAiProviderChatCompletionConfig(providerId);
  const baseCount = countWords(originalText);
  const minWords = Math.max(6, baseCount - TAILOR_REWRITE_WORD_MARGIN);
  const maxWords = baseCount + TAILOR_REWRITE_WORD_MARGIN;

  const { tenureCredentials, requirementSkills, softContext } =
    partitionRequirements(selectedRequirements);

  const keywordBlock =
    selectedKeywords.length > 0
      ? selectedKeywords.map((keyword) => `- ${keyword}`).join("\n")
      : "(No keywords selected — improve clarity only; do not add unrelated stack names.)";

  const tenureBlock =
    tenureCredentials.length > 0
      ? tenureCredentials.map((line) => `- ${line}`).join("\n")
      : "(None selected.)";

  const reqSkillBlock =
    requirementSkills.length > 0
      ? requirementSkills.map((line) => `- ${line}`).join("\n")
      : "(None selected.)";

  const softReqBlock =
    softContext.length > 0
      ? softContext.map((line) => `- ${line}`).join("\n")
      : "(None selected.)";

  const userMessage = [
    `Rewrite the SINGLE resume paragraph below for a job application.`,
    ``,
    `Truthfulness (non-negotiable):`,
    `- Do not invent employers, job titles, dates, tools, certifications, licenses, or metrics that the original paragraph cannot reasonably support.`,
    `- You may reorder, tighten, and align wording with the JD when it matches facts already stated or clearly implied.`,
    ``,
    `Length:`,
    `- Original is about ${baseCount} words. Target between ${minWords} and ${maxWords} words inclusive (about ±${TAILOR_REWRITE_WORD_MARGIN} words; count as whitespace-separated words).`,
    ``,
    `User-selected JD keywords (tools, stack, domain terms, or other chips the applicant chose):`,
    keywordBlock,
    `Instruction: Rephrase the paragraph so selected keywords appear naturally where truthful (use normal forms when obvious: e.g. Java, Python, Microsoft Excel). Prefer one integrated phrase over keyword stuffing. If the original contradicts a keyword, omit that keyword.`,
    ``,
    `Soft skills (light touch):`,
    `- Add a single short clause (roughly 6–14 words), clearly subordinate to results, that hints at professional soft skills (e.g. collaboration, stakeholder communication, ownership) only if it fits the original tone. Do not let soft skills dominate the bullet.`,
    ``,
    `Hard JD alignment — tenure, certifications, licenses, degrees, and concrete JD skill/tool lines (must surface explicitly in the rewrite when the original already supports or clearly implies them; NEVER fabricate):`,
    `Tenure, credentials, and formal requirements from the JD:`,
    tenureBlock,
    `Additional JD skill/tool requirement lines:`,
    reqSkillBlock,
    `Instruction: If the original mentions comparable tenure, a relevant certificate/license, or the same capability, mirror that language toward the JD (e.g. years of experience, forklift certification) without overstating. If the original cannot support a hard requirement, do not claim it.`,
    ``,
    `JD context — responsibilities and softer expectations (reflect lightly in tone or scope where natural; do not add new hard claims):`,
    softReqBlock,
    ``,
    `Return ONLY valid JSON with this exact shape: {"rewritten":"your rewritten paragraph as one string"}`,
    ``,
    `Original resume paragraph:`,
    originalText.trim(),
  ].join("\n");

  const requestJson: Record<string, unknown> = {
    model: provider.model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a concise resume editor. Output JSON only with key rewritten. Obey word-count bounds when possible. Honor keyword and hard-requirement instructions only when truthful to the original.",
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestJson),
    });
  } catch (fetchError) {
    const detail = fetchError instanceof Error ? fetchError.message : String(fetchError);
    return {
      ok: false,
      message: `${provider.displayName} rewrite request failed: ${detail}`,
      requestJson,
      responseJson: { error: "network_or_fetch", detail },
    };
  }

  const responseText = await response.text();
  let responseJson: unknown;
  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseJson = { raw: responseText };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `${provider.displayName} rewrite failed (${response.status}).`,
      requestJson,
      responseJson,
    };
  }

  const data = responseJson as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return {
      ok: false,
      message: `${provider.displayName} did not return rewrite content.`,
      requestJson,
      responseJson,
    };
  }

  let parsed: { rewritten?: string };
  try {
    parsed = JSON.parse(content) as { rewritten?: string };
  } catch {
    return {
      ok: false,
      message: "Model message was not valid JSON.",
      requestJson,
      responseJson,
    };
  }

  const rewritten = typeof parsed.rewritten === "string" ? parsed.rewritten.trim() : "";

  if (!rewritten) {
    return {
      ok: false,
      message: "Model returned an empty rewrite.",
      requestJson,
      responseJson,
    };
  }

  return {
    ok: true,
    rewritten,
    requestJson,
    responseJson,
  };
}
