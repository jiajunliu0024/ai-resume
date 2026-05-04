import {
  type Resume,
  type ResumeBasicInfo,
  type ResumeEducationItem,
  type ResumeExperienceItem,
  type ResumeProjectItem,
} from "../domain/resume";

export type ResumeSectionKey =
  | "basicInfo"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications";

export type ParsedResumeSections = Pick<Resume, ResumeSectionKey> & {
  basicInfoFields: ResumeBasicInfo;
  experienceItems: ResumeExperienceItem[];
  projectItems: ResumeProjectItem[];
  educationItems: ResumeEducationItem[];
};

const headingAliases: Record<Exclude<ResumeSectionKey, "basicInfo">, string[]> = {
  summary: ["summary", "profile", "professional summary", "career summary"],
  skills: [
    "skills",
    "technical skills",
    "key skills",
    "technologies",
    "tech stack",
  ],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
  ],
  projects: ["projects", "project experience", "selected projects"],
  education: ["education", "academic background", "qualifications"],
  certifications: ["certifications", "certificates", "licenses", "awards"],
};

const aliasToSection = new Map<string, Exclude<ResumeSectionKey, "basicInfo">>();
const dateRangePattern =
  "\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\\.?\\s*\\d{4}\\s*[-–]\\s*(?:present|current|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\\.?\\s*\\d{4})\\b";
const dateRangeRegex = new RegExp(dateRangePattern, "i");
const globalDateRangeRegex = new RegExp(dateRangePattern, "gi");

Object.entries(headingAliases).forEach(([section, aliases]) => {
  aliases.forEach((alias) => {
    aliasToSection.set(alias, section as Exclude<ResumeSectionKey, "basicInfo">);
  });
});

function normalizeResumeText(rawText: string): string {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHeading(value: string) {
  return value
    .replace(/[^a-zA-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findSectionFromLine(line: string) {
  const normalizedLine = normalizeHeading(line);
  const compactLine = normalizedLine.replace(/\s/g, "");

  for (const [alias, section] of aliasToSection.entries()) {
    const headingPattern = new RegExp(
      `(^|\\s)${alias.replace(/ /g, "\\s+")}(\\s|$)`,
      "i",
    );
    const compactAlias = alias.replace(/\s/g, "");

    if (
      headingPattern.test(normalizedLine) ||
      (compactAlias.length > 5 && compactLine.includes(compactAlias))
    ) {
      return section;
    }
  }

  return null;
}

function splitInlineHeadings(rawText: string): string {
  const aliases = Object.values(headingAliases)
    .flat()
    .sort((a, b) => b.length - a.length);
  const headingPattern = aliases
    .map((alias) =>
      alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"),
    )
    .join("|");
  const spacedHeadingPattern = aliases
    .filter((alias) => !alias.includes(" "))
    .map((alias) => alias.split("").join("\\s*"))
    .join("|");
  const combinedHeadingPattern = [headingPattern, spacedHeadingPattern]
    .filter(Boolean)
    .join("|");

  return rawText.replace(
    new RegExp(`\\b(${combinedHeadingPattern})\\b\\s*[:•-]?`, "gi"),
    (match, heading: string, offset: number, text: string) => {
      const previousCharacter = text[offset - 1];
      const startsAfterSectionBreak =
        !previousCharacter || "\n•|".includes(previousCharacter);
      const looksLikePdfHeading = heading === heading.toUpperCase();

      return startsAfterSectionBreak || looksLikePdfHeading
        ? `\n${heading}\n`
        : match;
    },
  );
}

function hasDateRange(value: string) {
  return dateRangeRegex.test(value);
}

function looksLikeRoleHeading(line: string, nextLine?: string) {
  return (
    hasDateRange(line) ||
    Boolean(nextLine && hasDateRange(nextLine) && line.length < 90)
  );
}

function splitRoleBlocks(sectionText: string) {
  const lines = sectionText
    .replace(globalDateRangeRegex, "\n$&\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  lines.forEach((line, index) => {
    if (looksLikeRoleHeading(line, lines[index + 1]) && currentBlock.length) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    currentBlock.push(line);
  });

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function extractDates(value: string) {
  return value.match(dateRangeRegex)?.[0] ?? "";
}

function extractBasicInfoFields(lines: string[]): ResumeBasicInfo {
  const joinedText = lines.join(" ");
  const email = joinedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone =
    joinedText.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{3,4}/)?.[0] ??
    "";
  const location =
    joinedText.match(
      /[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,?\s+(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+\d{4},?\s+Australia/i,
    )?.[0] ??
    joinedText.match(
      /[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,?\s+(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+\d{4}/i,
    )?.[0] ??
    "";
  const links = Array.from(
    new Set(
      [
        ...joinedText.matchAll(/https?:\/\/\S+|www\.\S+/gi),
        ...joinedText.matchAll(/\b(?:linkedin|github|portfolio)\b/gi),
      ].map((match) => match[0]),
    ),
  );
  const nameSource =
    lines.find(
      (line) =>
        !line.includes("@") &&
        !/\d{4}/.test(line) &&
        !/linkedin|github|portfolio|http|www/i.test(line) &&
        normalizeHeading(line).split(" ").length <= 5,
    ) ?? joinedText.split(email || phone || "|")[0];
  const name = nameSource
    .replace(phone, "")
    .replace(email, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name,
    email,
    phone,
    location,
    links,
  };
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

function parseExperienceItems(sectionText: string): ResumeExperienceItem[] {
  return splitRoleBlocks(sectionText).map((block, index) => {
    const header = block[0] ?? "";
    const secondLine = block[1] ?? "";
    const thirdLine = block[2] ?? "";
    const dates = extractDates(`${header} ${secondLine} ${thirdLine}`);
    const headerWithoutDates = header.replace(dates, "").trim();
    const headerParts = headerWithoutDates
      .split(/\s{2,}|\s[-|]\s/)
      .map((part) => part.trim())
      .filter(Boolean);
    const dateLineIndex = block.findIndex((line) => hasDateRange(line));
    const company =
      dateLineIndex > 0
        ? block[dateLineIndex - 1]
        : headerParts[0] ?? "";
    const title =
      dateLineIndex >= 0
        ? block[dateLineIndex + 1] ?? headerParts[headerParts.length - 1] ?? ""
        : headerParts[headerParts.length - 1] ?? headerWithoutDates;
    const detailStartIndex = dateLineIndex >= 0 ? dateLineIndex + 2 : 1;

    return {
      id: `experience-${index + 1}`,
      title,
      company,
      dates,
      location:
        block.find((line) => /australia|vic|nsw|qld|wa|sa|tas|act|remote/i.test(line)) ??
        "",
      achievements: block
        .slice(detailStartIndex)
        .filter((line) => line !== dates && line !== title),
    };
  });
}

function parseProjectItems(sectionText: string): ResumeProjectItem[] {
  return splitRoleBlocks(sectionText).map((block, index) => ({
    id: `project-${index + 1}`,
    name: block[0] ?? `Project ${index + 1}`,
    technologies:
      block.find((line) => /react|node|java|python|sql|aws|azure|docker|kubernetes|spring/i.test(line)) ??
      "",
    description: block.slice(1, 3).join("\n"),
    highlights: block.slice(3),
  }));
}

function parseEducationItems(sectionText: string): ResumeEducationItem[] {
  const preparedText = sectionText
    .replace(globalDateRangeRegex, "\n$&\n")
    .replace(
      /\s+(?=(?:bachelor|master|diploma|certificate|certification|graduate|postgraduate|university|tafe)\b)/gi,
      "\n",
    );
  const lines = preparedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  lines.forEach((line) => {
    const startsEducationEntry =
      /^(?:bachelor|master|diploma|certificate|certification|graduate|postgraduate)\b/i.test(
        line,
      );

    if (startsEducationEntry && currentBlock.length) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    currentBlock.push(line);
  });

  if (currentBlock.length) {
    blocks.push(currentBlock);
  }

  return blocks.map((block, index) => {
    const dates = extractDates(block.join(" "));
    const degree =
      block.find((line) =>
        /^(?:bachelor|master|diploma|certificate|certification|graduate|postgraduate)\b/i.test(
          line,
        ),
      ) ?? block[0] ?? "";
    const school =
      block.find((line) => /university|tafe|college|school|institute/i.test(line)) ??
      block.find((line) => line !== degree && line !== dates) ??
      "";

    return {
      id: `education-${index + 1}`,
      degree,
      school,
      dates,
      details: block
        .filter((line) => line !== degree && line !== school && line !== dates)
        .join("\n"),
    };
  });
}

export function parseResumeSections(rawText: string): ParsedResumeSections {
  const sections: Record<ResumeSectionKey, string[]> = {
    basicInfo: [],
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
  };
  const preparedText = splitInlineHeadings(normalizeResumeText(rawText));
  const lines = preparedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  let currentSection: ResumeSectionKey = "basicInfo";

  lines.forEach((line) => {
    const nextSection = findSectionFromLine(line);

    if (nextSection) {
      currentSection = nextSection;
      return;
    }

    if (currentSection === "basicInfo" && hasDateRange(line)) {
      currentSection = "experience";
    }

    sections[currentSection].push(line);
  });

  const basicInfoFields = extractBasicInfoFields(sections.basicInfo);
  const experience = sections.experience.join("\n");
  const projects = sections.projects.join("\n");
  const education = sections.education.join("\n");

  return {
    basicInfo: formatBasicInfo(basicInfoFields) || sections.basicInfo.join("\n"),
    basicInfoFields,
    summary: sections.summary.join("\n"),
    skills: sections.skills.join("\n"),
    experience,
    experienceItems: parseExperienceItems(experience),
    projects,
    projectItems: parseProjectItems(projects),
    education,
    educationItems: parseEducationItems(education),
    certifications: sections.certifications.join("\n"),
  };
}
