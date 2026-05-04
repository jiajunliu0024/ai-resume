import {
  type Resume,
  type ResumeBasicInfo,
  type ResumeEducationItem,
  type ResumeExperienceItem,
  type ResumeProjectItem,
} from "../domain/resume";
import { finalizeExperienceAchievements } from "../shared/experienceAchievements";

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
    .replace(/[•●▪∙]/g, "\n")
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

/** Split body text on hollow/filled bullets (PDFs often use ◦). */
function splitAchievementSegments(text: string): string[] {
  return text
    .split(/\s*[◦•●▪∙]\s*/g)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment.length > 8);
}

function splitHeadIntoTitleLocation(head: string): { title: string; location: string } {
  const twoColumn = head.match(/^(.+?)\s{2,}(.+)$/);
  if (twoColumn) {
    return { title: twoColumn[1]!.trim(), location: twoColumn[2]!.trim() };
  }

  const cityTail = head.match(
    /^(.+?)\s+((?:Melbourne|Sydney|Brisbane|Perth|Adelaide|Global|Remote)(?:\s*,\s*Australia)?)\s*$/i,
  );
  if (cityTail) {
    return { title: cityTail[1]!.trim(), location: cityTail[2]!.trim() };
  }

  return { title: head.trim(), location: "" };
}

function isCompanyOnlyStub(item: ResumeExperienceItem): boolean {
  if (item.dates || item.achievements.length > 0) {
    return false;
  }

  if (!item.title || item.title !== item.company) {
    return false;
  }

  return item.company.length > 0 && item.company.length < 90;
}

function mergeStubWithFollowing(
  stub: ResumeExperienceItem,
  detail: ResumeExperienceItem,
): ResumeExperienceItem {
  const combinedText = [detail.title, detail.location].join(" ").replace(/\s+/g, " ").trim();
  const dates = detail.dates || extractDates(combinedText);
  const withoutDates = combinedText.replace(dates, "").replace(/\s+/g, " ").trim();
  const segments = splitAchievementSegments(withoutDates);
  const head = (segments[0] ?? withoutDates).trim();
  const achievements = segments.slice(1);

  const { title: parsedTitle, location: parsedLocation } = splitHeadIntoTitleLocation(head);

  let company = stub.company.trim();
  if (/^volunteer$/i.test(company)) {
    const org = combinedText.match(
      /(?:The\s+)?[A-Z][A-Za-z\s]{2,48}Foundation|[A-Za-z]+\s+Foundation\b/,
    );
    if (org) {
      company = org[0]!.trim();
    }
  }

  return {
    id: stub.id,
    company,
    dates,
    title: parsedTitle,
    location: parsedLocation,
    achievements: achievements.length > 0 ? achievements : [],
  };
}

function mergeAdjacentCompanyStubs(items: ResumeExperienceItem[]): ResumeExperienceItem[] {
  const merged: ResumeExperienceItem[] = [];
  let index = 0;

  while (index < items.length) {
    const current = items[index]!;
    const next = items[index + 1];

    if (next && isCompanyOnlyStub(current)) {
      merged.push(mergeStubWithFollowing(current, next));
      index += 2;
      continue;
    }

    merged.push(current);
    index += 1;
  }

  return merged.map((item, itemIndex) => ({
    ...item,
    id: `experience-${itemIndex + 1}`,
  }));
}

function refineExperienceAchievements(item: ResumeExperienceItem): ResumeExperienceItem {
  if (item.achievements.length > 0) {
    return item;
  }

  const blob = `${item.title} ${item.location}`.replace(/\s+/g, " ").trim();
  if (!/[◦•]/.test(blob)) {
    return item;
  }

  const segments = splitAchievementSegments(blob);
  if (segments.length < 2) {
    return item;
  }

  const dates = item.dates || extractDates(segments[0]!);
  const head = segments[0]!.replace(dates, "").trim();
  const achievements = segments.slice(1);
  const { title, location } = splitHeadIntoTitleLocation(head);

  return {
    ...item,
    dates: dates || item.dates,
    title,
    location: location || item.location,
    achievements,
  };
}

function parseExperienceItems(sectionText: string): ResumeExperienceItem[] {
  const draftItems = splitRoleBlocks(sectionText).map((block, index) => {
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

  return mergeAdjacentCompanyStubs(draftItems)
    .map(refineExperienceAchievements)
    .map((item) => ({
      ...item,
      achievements: finalizeExperienceAchievements(
        item.achievements,
        item.title,
        item.location,
      ),
    }));
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

function parseEducationBulletChunk(chunk: string, index: number): ResumeEducationItem {
  const dates = extractDates(chunk);
  const rest = chunk.replace(dates, "").replace(/\s+/g, " ").trim();

  const schoolMatch = rest.match(
    /((?:The\s+)?University\s+of\s+\w+|Monash University|RMIT(?:\s+University)?|Deakin University|TAFE[\w\s]*)/i,
  );
  let school = schoolMatch?.[1]?.trim() ?? "";

  const degreeMatch = rest.match(
    /\b((?:Master|Bachelor|Doctor(?:ate)?|Graduate\s+Diploma)\s+of\s+[\w\s.'&,]+?)(?=\s+(?:Melbourne|Sydney|Brisbane|Perth|Australia)\b|\s*$)/i,
  );
  let degree = degreeMatch?.[1]?.trim() ?? "";

  degree = degree.replace(/\s*(Melbourne,\s*Australia|Australia)\s*$/gi, "").trim();

  if (!degree) {
    degree = rest
      .replace(school, "")
      .replace(/Melbourne,\s*Australia/gi, "")
      .trim();
  }

  const details = rest
    .replace(school, "")
    .replace(degree, "")
    .replace(/Melbourne,\s*Australia/gi, "")
    .trim();

  if (!school && /University|Monash|RMIT|Deakin|TAFE/i.test(rest)) {
    school = rest
      .replace(degree, "")
      .replace(/Melbourne,\s*Australia/gi, "")
      .trim();
  }

  return {
    id: `education-${index + 1}`,
    degree,
    school,
    dates,
    details,
  };
}

/** Joins a lone "The" line with "University of ..." (common PDF line breaks). */
function joinBrokenSchoolNameLines(lines: string[]): string[] {
  const out: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const next = lines[index + 1];

    if (/^the\s*$/i.test(line) && next && /^university\b/i.test(next)) {
      out.push(`${line.trim()} ${next.trim()}`);
      index += 1;
      continue;
    }

    out.push(line);
  }

  return out;
}

function parseEducationItems(sectionText: string): ResumeEducationItem[] {
  if (!sectionText.trim()) {
    return [];
  }

  const bulletChunks = sectionText
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n• ")
    .split(/\n•\s*/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length > 8);

  const looksLikeUniBullets =
    bulletChunks.length >= 2 &&
    bulletChunks.some((chunk) => /university|monash|bachelor|master|doctor/i.test(chunk));

  if (looksLikeUniBullets) {
    return bulletChunks.map((chunk, index) => parseEducationBulletChunk(chunk, index));
  }

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
  const joinedLines = joinBrokenSchoolNameLines(lines);
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  joinedLines.forEach((line) => {
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
