import {
  getAiProviderChatCompletionConfig,
  type AiProviderId,
} from "./openAiJobInsightsExtractor";

export type CoverLetterPromptChunk = {
  heading: string;
  body: string;
};

export type GenerateCoverLetterAiInput = {
  jobTitle: string;
  company: string;
  jdSnippet: string;
  keywordLines: string[];
  requirementLines: string[];
  resumeBlocks: CoverLetterPromptChunk[];
  apiKey: string;
  providerId: AiProviderId;
};

type CoverLetterJson = {
  letter?: string;
};

function parseLetterJson(content: string): string {
  const parsed = JSON.parse(content) as CoverLetterJson;
  const letter = typeof parsed.letter === "string" ? parsed.letter.trim() : "";
  if (!letter) {
    throw new Error("Model returned empty cover letter.");
  }
  return letter;
}

/**
 * Calls the user's OpenAI-compatible provider to draft a cover letter from JD + user-selected context.
 */
export async function generateCoverLetterWithAiProvider(
  input: GenerateCoverLetterAiInput,
): Promise<string> {
  const { jobTitle, company, jdSnippet, keywordLines, requirementLines, resumeBlocks, apiKey, providerId } =
    input;
  const provider = getAiProviderChatCompletionConfig(providerId);

  const keywordSection =
    keywordLines.length > 0
      ? `Keywords the candidate wants to reflect (from the JD):\n${keywordLines.map((l) => `- ${l}`).join("\n")}`
      : "No keywords were selected.";

  const requirementSection =
    requirementLines.length > 0
      ? `Key requirements to address (from the JD):\n${requirementLines.map((l) => `- ${l}`).join("\n")}`
      : "No key requirements were selected.";

  const resumeSection =
    resumeBlocks.length > 0
      ? resumeBlocks
          .map((block) => `### ${block.heading}\n${block.body}`)
          .join("\n\n")
      : "No resume excerpts were selected.";

  const userContent = `Write a tailored cover letter for this role.

Job title: ${jobTitle}
Company: ${company}

Job description excerpt (for tone and facts only; do not invent duties the candidate did not do):
${jdSnippet}

${keywordSection}

${requirementSection}

Resume excerpts provided by the candidate (only use facts supported here; do not invent employers, dates, tools, or degrees):
${resumeSection}

Return strict JSON only in this shape:
{ "letter": "full cover letter body with paragraph breaks as \\n" }

Rules:
- Professional, concise tone; roughly 220–360 words unless the excerpts are very thin.
- Connect selected requirements and keywords to the resume excerpts only where truthful.
- Do not fabricate experience, metrics, employers, degrees, or tools that are not implied by the excerpts.
- Do not include a subject line or "Dear Hiring Manager" placeholder unless you have a real recipient name in the data; "Dear Hiring Team" is acceptable.
- No markdown fences in the letter text; plain text with newlines only.`;

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write truthful, role-specific cover letters. Return strict JSON only with a single key \"letter\".",
        },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.displayName} request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Model did not return cover letter content.");
  }

  return parseLetterJson(content);
}
