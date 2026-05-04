import type {
  Resume,
  ResumeBasicInfo,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeProjectItem,
} from "../../domain/resume";
import { escapeHrefUrl, escapeLatex } from "./escapeLatex";
import classicPreamble from "./preambles/classic-article.preamble.tex?raw";
import minimalPreamble from "./preambles/minimal-article.preamble.tex?raw";
import plainPreamble from "./preambles/plain-article.preamble.tex?raw";

export const RESUME_LATEX_TEMPLATE_IDS = ["classic-sample", "minimal-clean", "plain-sections"] as const;
export type ResumeLatexTemplateId = (typeof RESUME_LATEX_TEMPLATE_IDS)[number];

export const RESUME_LATEX_TEMPLATES: {
  id: ResumeLatexTemplateId;
  name: string;
  description: string;
  /** Popular LaTeX résumé ecosystems users can paste this export into on Overleaf. */
  inspiredBy?: string;
}[] = [
  {
    id: "classic-sample",
    name: "Classic (project sample.tex)",
    description:
      "Article class with titlesec, enumitem, hyperref, fontawesome5 — matches your repository sample.tex layout.",
    inspiredBy: "Jake Gutstein / Overleaf-style article résumés; similar spirit to Awesome-CV (icons + tight lists).",
  },
  {
    id: "minimal-clean",
    name: "Minimal (fewer packages)",
    description: "Geometry + hyperref + enumitem only. Easiest to compile when some fancy packages are missing.",
    inspiredBy: "Good fallback when AltaCV / moderncv class files are not in the project.",
  },
  {
    id: "plain-sections",
    name: "Plain sections",
    description: "Simple bold section titles with titlerule; standard itemize body.",
    inspiredBy: "ATS-oriented single-column layouts (conceptually similar to simple moderncv banking variants).",
  },
];

export type RenderResumeLatexInput = {
  resume: Resume;
  basicInfo: ResumeBasicInfo;
  educationItems: ResumeEducationItem[];
  selectedSkills: string[];
};

const PREAMBLES: Record<ResumeLatexTemplateId, string> = {
  "classic-sample": classicPreamble,
  "minimal-clean": minimalPreamble,
  "plain-sections": plainPreamble,
};

function normalizeHttpUrl(link: string): string {
  const t = link.trim();
  if (!t) {
    return "";
  }

  if (/^https?:\/\//i.test(t)) {
    return t;
  }

  if (/^www\./i.test(t)) {
    return `https://${t}`;
  }

  return `https://${t}`;
}

function latexSocialClassic(links: string[]): string {
  if (!links.length) {
    return "";
  }

  const parts = links
    .map((link) => {
      const href = escapeHrefUrl(normalizeHttpUrl(link));
      const lower = link.toLowerCase();
      if (lower.includes("linkedin")) {
        return `\\socialicon{\\faLinkedin} \\href{${href}}{${escapeLatex("LinkedIn")}}`;
      }

      if (lower.includes("github")) {
        return `\\socialicon{\\faGithub} \\href{${href}}{${escapeLatex("GitHub")}}`;
      }

      return `\\socialicon{\\faGlobe} \\href{${href}}{${escapeLatex("Website")}}`;
    })
    .filter(Boolean);

  return parts.join(" \\quad | \\quad ");
}

function latexContactLineMinimal(basic: ResumeBasicInfo): string {
  const bits: string[] = [];
  if (basic.phone.trim()) {
    bits.push(escapeLatex(basic.phone.trim()));
  }

  if (basic.email.trim()) {
    const e = basic.email.trim();
    bits.push(`\\href{mailto:${escapeHrefUrl(e)}}{${escapeLatex(e)}}`);
  }

  return bits.join(" \\quad | \\quad ");
}

function latexSocialMinimal(links: string[]): string {
  if (!links.length) {
    return "";
  }

  return links
    .map((link) => {
      const href = escapeHrefUrl(normalizeHttpUrl(link));
      return `\\href{${href}}{${escapeLatex(linkDisplayLabel(link))}}`;
    })
    .join(" \\quad | \\quad ");
}

function linkDisplayLabel(link: string): string {
  const lower = link.toLowerCase();
  if (lower.includes("linkedin")) {
    return "LinkedIn";
  }

  if (lower.includes("github")) {
    return "GitHub";
  }

  return "Link";
}

function latexParagraphBlock(text: string | undefined): string {
  if (!text?.trim()) {
    return "";
  }

  return escapeLatex(text.trim())
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .join("\\par\\smallskip\n");
}

function buildExperienceClassic(items: ResumeExperienceItem[]): string {
  if (!items.length) {
    return "% (No structured experience rows — edit in Tailor or paste below.)\n";
  }

  const blocks = items.map((item) => {
    const bullets = item.achievements
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => `    \\item ${escapeLatex(a)}`)
      .join("\n");

    const list =
      bullets.length > 0
        ? `\\resumeItemListStart\n${bullets}\n\\resumeItemListEnd`
        : `\\resumeItemListStart
    \\item \\textit{Add achievement bullets in Tailor for this role.}
\\resumeItemListEnd`;

    return `\\resumeSubheading
    {${escapeLatex(item.company || "Company")}}{${escapeLatex(item.location || "")}}
    {${escapeLatex(item.title || "Title")}}{${escapeLatex(item.dates || "")}}
${list}`;
  });

  return `\\section{\\textbf{Experience}}
\\vspace{-0.4mm}
\\resumeSubHeadingListStart

${blocks.join("\n\n")}

\\resumeSubHeadingListEnd
`;
}

function buildEducationClassic(items: ResumeEducationItem[]): string {
  const usable = items.filter((e) => e.school.trim() || e.degree.trim());
  if (!usable.length) {
    return "";
  }

  const blocks = usable.map(
    (e) => `\\resumeSubheading
    {${escapeLatex(e.school || "School")}}{${escapeLatex(e.details || "")}}
    {${escapeLatex(e.degree || "Degree")}}{${escapeLatex(e.dates || "")}}`,
  );

  return `\\vspace{-6mm}

\\section{\\textbf{Education}}
\\vspace{-0.4mm}
\\resumeSubHeadingListStart

${blocks.join("\n\n")}

\\resumeSubHeadingListEnd
`;
}

function buildSkillsClassic(selectedSkills: string[]): string {
  if (!selectedSkills.length) {
    return "";
  }

  const body = `    \\resumeSubItem{Technical skills:}
        {${escapeLatex(selectedSkills.join(", "))}}`;

  return `\\vspace{-6mm}

\\section{\\textbf{Skills}}
\\vspace{-0.4mm}
\\resumeHeadingSkillStart
${body}
\\resumeHeadingSkillEnd
`;
}

function buildProjectsClassic(items: ResumeProjectItem[]): string {
  if (!items.length) {
    return "";
  }

  const blocks = items.map((p) => {
    const highlights = p.highlights
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => `    \\item ${escapeLatex(h)}`)
      .join("\n");
    const desc = p.description.trim()
      ? `    \\item ${escapeLatex(p.description.trim())}`
      : "";
    const inner = [desc, highlights].filter(Boolean).join("\n");
    const list =
      inner.length > 0
        ? `\\resumeItemListStart\n${inner}\n\\resumeItemListEnd`
        : "";

    return `\\resumeProject
    {${escapeLatex(p.name)}}{${escapeLatex(p.technologies)}}{}{}
${list}`;
  });

  return `\\vspace{-6mm}

\\section{\\textbf{Projects}}
\\vspace{-0.4mm}
\\resumeSubHeadingListStart

${blocks.join("\n\n")}

\\resumeSubHeadingListEnd
`;
}

function buildCertificationsClassic(certifications: string | undefined): string {
  if (!certifications?.trim()) {
    return "";
  }

  const items = certifications
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `    \\item ${escapeLatex(line)}`)
    .join("\n");

  return `\\vspace{-6mm}

\\section{\\textbf{Certifications}}
\\vspace{-0.4mm}
\\resumeItemListStart
${items}
\\resumeItemListEnd
`;
}

function buildSummaryClassic(summary: string | undefined): string {
  const body = latexParagraphBlock(summary);
  if (!body) {
    return "";
  }

  return `\\section{\\textbf{Summary}}
\\vspace{-0.4mm}
\\noindent\\small
${body}
\\vspace{2mm}
`;
}

function buildBodyClassic(input: RenderResumeLatexInput): string {
  const { resume, basicInfo, educationItems, selectedSkills } = input;
  const name = basicInfo.name.trim() || resume.title || "Your Name";
  const phone = basicInfo.phone.trim();
  const email = basicInfo.email.trim();
  const location = basicInfo.location.trim();
  const social = latexSocialClassic(basicInfo.links);

  const contactLine = [
    phone ? escapeLatex(phone) : "",
    email ? `\\href{mailto:${escapeHrefUrl(email)}}{${escapeLatex(email)}}` : "",
  ]
    .filter(Boolean)
    .join(" \\quad | \\quad ");

  const headerSegments: string[] = [
    `\\begin{center}
    {\\Huge\\textbf{${escapeLatex(name)}}}
\\end{center}`,
  ];

  if (contactLine) {
    headerSegments.push(`\\begin{center}
    \\small{
    ${contactLine}
    }
\\end{center}`);
  }

  if (social) {
    headerSegments.push(`\\begin{center}
    \\small{
    ${social}
    }
\\end{center}`);
  }

  if (location) {
    headerSegments.push(`\\begin{center}
    \\small{${escapeLatex(location)}}
\\end{center}`);
  }

  const header = `${headerSegments.join("\n\\vspace{-6mm}\n")}\n\\vspace{-4mm}\n`;

  const experienceItems = resume.experienceItems ?? [];

  return [
    header,
    buildSummaryClassic(resume.summary),
    buildExperienceClassic(experienceItems),
    buildEducationClassic(educationItems),
    buildSkillsClassic(selectedSkills),
    buildProjectsClassic(resume.projectItems ?? []),
    buildCertificationsClassic(resume.certifications),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBodyMinimalPlain(
  input: RenderResumeLatexInput,
  style: "minimal" | "plain",
): string {
  const { resume, basicInfo, educationItems, selectedSkills } = input;
  const name = basicInfo.name.trim() || resume.title || "Your Name";
  const sectionCmd = style === "minimal" ? "\\section*" : "\\section";

  const contact = latexContactLineMinimal(basicInfo);
  const links = latexSocialMinimal(basicInfo.links);
  const loc = basicInfo.location.trim() ? escapeLatex(basicInfo.location.trim()) : "";

  const header = `\\begin{center}
{\\LARGE\\textbf{${escapeLatex(name)}}}\\par\\smallskip
\\small
${[contact, links].filter(Boolean).join(" \\par ")}
${loc ? ` \\par ${loc}` : ""}
\\end{center}
\\vspace{8pt}
`;

  const summaryBody = latexParagraphBlock(resume.summary);
  const summary =
    summaryBody.length > 0
      ? `${sectionCmd}{Summary}\\par\\smallskip\n\\noindent\\small ${summaryBody}\\par\\medskip\n`
      : "";

  const expItems = resume.experienceItems ?? [];
  let experience = "";
  if (expItems.length) {
    const blocks = expItems.map((item) => {
      const meta = [item.title, item.company, item.dates, item.location]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" · ");
      const bullets = item.achievements
        .map((a) => a.trim())
        .filter(Boolean)
        .map((a) => `  \\item ${escapeLatex(a)}`)
        .join("\n");
      return `\\textbf{${escapeLatex(meta)}}\\par\\smallskip\n\\begin{itemize}\n${bullets || "  \\item % add bullets in Tailor\n"}\\end{itemize}`;
    });
    experience = `${sectionCmd}{Experience}\\par\\medskip\n${blocks.join("\\par\\medskip\n")}\n`;
  }

  const eduUsable = educationItems.filter((e) => e.school.trim() || e.degree.trim());
  let education = "";
  if (eduUsable.length) {
    const blocks = eduUsable.map((e) => {
      const line = [e.degree, e.school, e.dates].map((s) => s.trim()).filter(Boolean).join(" · ");
      const extra = e.details.trim() ? `\\par\\smallskip ${escapeLatex(e.details.trim())}` : "";
      return `\\textbf{${escapeLatex(line)}}${extra}`;
    });
    education = `${sectionCmd}{Education}\\par\\smallskip\n${blocks.join("\\par\\medskip\n")}\n`;
  }

  let skills = "";
  if (selectedSkills.length) {
    skills = `${sectionCmd}{Skills}\\par\\smallskip\n\\noindent ${escapeLatex(selectedSkills.join(", "))}\\par\\medskip\n`;
  }

  let projects = "";
  const pItems = resume.projectItems ?? [];
  if (pItems.length) {
    const blocks = pItems.map((p) => {
      const head = `${escapeLatex(p.name)} — ${escapeLatex(p.technologies)}`;
      const lines = [p.description, ...p.highlights].map((s) => s.trim()).filter(Boolean);
      const inner = lines.map((line) => `  \\item ${escapeLatex(line)}`).join("\n");
      return `\\textbf{${head}}\\par\\smallskip\n\\begin{itemize}\n${inner}\\end{itemize}`;
    });
    projects = `${sectionCmd}{Projects}\\par\\medskip\n${blocks.join("\\par\\medskip\n")}\n`;
  }

  let certs = "";
  if (resume.certifications?.trim()) {
    const lines = resume.certifications
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `  \\item ${escapeLatex(l)}`)
      .join("\n");
    certs = `${sectionCmd}{Certifications}\\par\\smallskip\n\\begin{itemize}\n${lines}\\end{itemize}\n`;
  }

  return [header, summary, experience, education, skills, projects, certs].filter(Boolean).join("\n");
}

export function renderResumeToLatex(
  input: RenderResumeLatexInput,
  templateId: ResumeLatexTemplateId,
): string {
  const preamble = PREAMBLES[templateId];
  const body =
    templateId === "classic-sample"
      ? buildBodyClassic(input)
      : templateId === "minimal-clean"
        ? buildBodyMinimalPlain(input, "minimal")
        : buildBodyMinimalPlain(input, "plain");

  return `${preamble.trimEnd()}\n${body}\n\\end{document}\n`;
}

export function isResumeLatexTemplateId(value: string): value is ResumeLatexTemplateId {
  return (RESUME_LATEX_TEMPLATE_IDS as readonly string[]).includes(value);
}
