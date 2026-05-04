import {
  type ResumeBasicInfo,
  type ResumeEducationItem,
  type ResumeExperienceItem,
  type ResumeProjectItem,
} from "../../domain/resume";
import { type AiProviderId } from "./openAiJobInsightsExtractor";

export type AiParsedResume = {
  basicInfoFields: ResumeBasicInfo;
  basicInfo: string;
  summary: string;
  skills: string;
  experience: string;
  experienceItems: ResumeExperienceItem[];
  projects: string;
  projectItems: ResumeProjectItem[];
  education: string;
  educationItems: ResumeEducationItem[];
  certifications: string;
};

type AiProviderConfig = {
  displayName: string;
  endpoint: string;
  model: string;
};

const providerConfigs: Record<AiProviderId, AiProviderConfig> = {
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

/** Multimodal PDF-page parsing is implemented for OpenAI only (vision-capable model). */
export function supportsResumePdfVisionParsing(providerId: AiProviderId): boolean {
  return providerId === "openai";
}

const RESUME_JSON_SHAPE_AND_RULES = `Parse these resume page images into this exact JSON shape:
{
  "basicInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "links": []
  },
  "summary": "",
  "skills": [],
  "experienceItems": [
    {
      "title": "",
      "company": "",
      "dates": "",
      "location": "",
      "achievements": []
    }
  ],
  "projectItems": [
    {
      "name": "",
      "technologies": "",
      "description": "",
      "highlights": []
    }
  ],
  "educationItems": [
    {
      "degree": "",
      "school": "",
      "dates": "",
      "details": ""
    }
  ],
  "certifications": []
}

Rules:
- Read only what appears in the images. Do not invent employers, dates, degrees, or metrics.
- Preserve all real resume content somewhere in the structure.
- experienceItems: one entry per distinct employment or internship role (merge company line, job title, dates, location, and bullet achievements into a single entry). Do not split one role into multiple entries.
- Put bullet text and outcomes in achievements arrays (one string per bullet).
- projectItems: separate named projects/portfolios if they appear as distinct project blocks; otherwise leave empty.
- educationItems: one entry per degree or program (e.g. one row for Bachelor, one for Master). Keep school and degree fields aligned with the document.
- Volunteer or unpaid roles may appear in experienceItems; set title or company to reflect volunteer status if shown.
- If a value is missing, use an empty string or empty array.
- Do not include markdown or explanation outside the JSON.`;

function makeId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function formatBasicInfo(fields: ResumeBasicInfo) {
  return [
    fields.name,
    fields.email,
    fields.phone,
    fields.location,
    fields.links.join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatExperienceItems(items: ResumeExperienceItem[]) {
  return items
    .map((item) =>
      [
        [item.title, item.company, item.dates, item.location]
          .filter(Boolean)
          .join(" | "),
        ...item.achievements,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function formatProjectItems(items: ResumeProjectItem[]) {
  return items
    .map((item) =>
      [item.name, item.technologies, item.description, ...item.highlights]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function formatEducationItems(items: ResumeEducationItem[]) {
  return items
    .map((item) =>
      [item.degree, item.school, item.dates, item.details]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function normalizeAiResumeJson(content: string): AiParsedResume {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const basicInfo = (parsed.basicInfo ?? {}) as Record<string, unknown>;
  const basicInfoFields: ResumeBasicInfo = {
    name: normalizeString(basicInfo.name),
    email: normalizeString(basicInfo.email),
    phone: normalizeString(basicInfo.phone),
    location: normalizeString(basicInfo.location),
    links: normalizeStringArray(basicInfo.links),
  };
  const experienceItems = Array.isArray(parsed.experienceItems)
    ? parsed.experienceItems.map((item, index) => {
        const entry = item as Record<string, unknown>;

        return {
          id: normalizeString(entry.id) || makeId("experience", index),
          title: normalizeString(entry.title),
          company: normalizeString(entry.company),
          dates: normalizeString(entry.dates),
          location: normalizeString(entry.location),
          achievements: normalizeStringArray(entry.achievements),
        };
      })
    : [];
  const projectItems = Array.isArray(parsed.projectItems)
    ? parsed.projectItems.map((item, index) => {
        const entry = item as Record<string, unknown>;

        return {
          id: normalizeString(entry.id) || makeId("project", index),
          name: normalizeString(entry.name),
          technologies: normalizeString(entry.technologies),
          description: normalizeString(entry.description),
          highlights: normalizeStringArray(entry.highlights),
        };
      })
    : [];
  const educationItems = Array.isArray(parsed.educationItems)
    ? parsed.educationItems.map((item, index) => {
        const entry = item as Record<string, unknown>;

        return {
          id: normalizeString(entry.id) || makeId("education", index),
          degree: normalizeString(entry.degree),
          school: normalizeString(entry.school),
          dates: normalizeString(entry.dates),
          details: normalizeString(entry.details),
        };
      })
    : [];

  return {
    basicInfoFields,
    basicInfo: formatBasicInfo(basicInfoFields),
    summary: normalizeString(parsed.summary),
    skills: normalizeStringArray(parsed.skills).join(", "),
    experience: formatExperienceItems(experienceItems),
    experienceItems,
    projects: formatProjectItems(projectItems),
    projectItems,
    education: formatEducationItems(educationItems),
    educationItems,
    certifications: normalizeStringArray(parsed.certifications).join("\n"),
  };
}

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } };

/**
 * Sends rasterized PDF pages (data URLs) to OpenAI vision; does not send extracted PDF text.
 */
export async function parseResumeWithAiProviderFromPdfPageImages(
  pageImageDataUrls: string[],
  apiKey: string,
  providerId: AiProviderId,
): Promise<AiParsedResume> {
  if (providerId !== "openai") {
    throw new Error("PDF page image parsing requires OpenAI in this build.");
  }

  if (!pageImageDataUrls.length) {
    throw new Error("No PDF page images to send for resume parsing.");
  }

  const provider = providerConfigs[providerId];
  const userContent: VisionContentPart[] = [
    {
      type: "text",
      text: `${RESUME_JSON_SHAPE_AND_RULES}\n\nImages are consecutive pages of one resume PDF (page 1 first).`,
    },
    ...pageImageDataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];

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
            "You parse resume document images into strict structured JSON. Return JSON only. Do not invent information. Use only text visible in the images.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${provider.displayName} resume parse failed (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`${provider.displayName} did not return resume JSON.`);
  }

  return normalizeAiResumeJson(content);
}
