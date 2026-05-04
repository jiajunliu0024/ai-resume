import {
  type ExtractJobInsightsResult,
} from "../../application/extractJobInsights";
import {
  type ExtractedRequirement,
  type RequirementCategory,
} from "../../domain/jobDescription";

type OpenAiRequirement = {
  text: string;
  category: RequirementCategory;
  importance: "high" | "medium" | "low";
  evidence: string;
};

type OpenAiJobInsightsResponse = {
  jobTitle?: string;
  company?: string;
  requirements: OpenAiRequirement[];
  keywords: OpenAiRequirement[];
  confidence: number;
};

export type AiProviderId = "openai" | "deepseek";

export type AiProviderChatCompletionConfig = {
  displayName: string;
  endpoint: string;
  model: string;
};

const providerConfigs: Record<AiProviderId, AiProviderChatCompletionConfig> = {
  openai: {
    displayName: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  deepseek: {
    displayName: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
  },
};

export function getAiProviderChatCompletionConfig(
  providerId: AiProviderId,
): AiProviderChatCompletionConfig {
  return providerConfigs[providerId];
}

// Only these categories are allowed in our domain model.
// If OpenAI returns something else, we normalize it to "other".
const allowedCategories: RequirementCategory[] = [
  "skill",
  "tool",
  "experience",
  "responsibility",
  "qualification",
  "other",
];

// Generate stable local ids from AI text so React can render lists safely.
function makeId(prefix: string, text: string): string {
  return `${prefix}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}`;
}

// Convert one OpenAI item into the app's ExtractedRequirement domain type.
function normalizeRequirement(
  item: OpenAiRequirement,
  prefix: string,
): ExtractedRequirement {
  const category = allowedCategories.includes(item.category)
    ? item.category
    : "other";

  return {
    id: makeId(prefix, item.text),
    text: item.text,
    category,
    importance: item.importance ?? "medium",
    evidence: item.evidence,
  };
}

// Parse and defensively normalize AI provider JSON output.
// The model is instructed to return JSON, but this still protects the UI.
function parseOpenAiJson(content: string): OpenAiJobInsightsResponse {
  const parsed = JSON.parse(content) as Partial<OpenAiJobInsightsResponse>;

  return {
    jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : undefined,
    company: typeof parsed.company === "string" ? parsed.company : undefined,
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(Math.max(parsed.confidence, 0), 1)
        : 0.75,
  };
}

// Main AI adapter for Scan.
// input: raw JD text + user's API key + selected provider.
// output: structured requirements, keywords, and confidence.
export async function extractJobInsightsWithAiProvider(
  rawText: string,
  apiKey: string,
  providerId: AiProviderId,
): Promise<ExtractJobInsightsResult> {
  const provider = providerConfigs[providerId];

  // This extension calls the AI provider directly because the product is local-first and
  // the user brings their own API key. No custom backend receives the resume/JD.
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract job requirements from job descriptions. Return strict JSON only.",
        },
        {
          role: "user",
          // The prompt asks for evidence so each extracted item is traceable to the JD.
          content: `Extract the job title, company, key requirements, and keywords from this job description.

Return this JSON shape:
{
  "jobTitle": "specific role title from the JD, not the website title",
  "company": "company name from the JD",
  "requirements": [
    {
      "text": "short requirement",
      "category": "skill | tool | experience | responsibility | qualification | other",
      "importance": "high | medium | low",
      "evidence": "exact supporting phrase from the job description"
    }
  ],
  "keywords": [
    {
      "text": "keyword",
      "category": "skill | tool | experience | responsibility | qualification | other",
      "importance": "high | medium | low",
      "evidence": "exact supporting phrase from the job description"
    }
  ],
  "confidence": 0.0
}

Rules:
- jobTitle must be the actual role, for example "Graduate Software Solutions Programmer/Consultant", not "SEEK" or a browser page title.
- company must be the hiring company from the JD.
- Keep requirements concrete and useful for tailoring a resume.
- Include technical tools, programming languages, work rights, location, responsibilities, and soft skills when important.
- Do not invent anything that is not supported by the JD.
- Limit requirements to 8 items.
- Limit keywords to 14 items.

Job description:
${rawText.slice(0, 14000)}`,
        },
      ],
    }),
  });

  // Surface provider errors to the Scan page so the user can fix key/quota issues.
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${provider.displayName} request failed (${response.status}): ${errorText}`,
    );
  }

  // OpenAI-compatible chat/completions returns model text inside choices[0].message.content.
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI did not return extraction content.");
  }

  const parsed = parseOpenAiJson(content);

  // Convert model JSON into stable app data and cap list sizes for the UI.
  return {
    jobTitle: parsed.jobTitle,
    company: parsed.company,
    requirements: parsed.requirements
      .slice(0, 8)
      .map((item) => normalizeRequirement(item, "ai-requirement")),
    keywords: parsed.keywords
      .slice(0, 14)
      .map((item) => normalizeRequirement(item, "ai-keyword")),
    confidence: parsed.confidence,
  };
}

export async function extractJobInsightsWithOpenAi(
  rawText: string,
  apiKey: string,
): Promise<ExtractJobInsightsResult> {
  return extractJobInsightsWithAiProvider(rawText, apiKey, "openai");
}
