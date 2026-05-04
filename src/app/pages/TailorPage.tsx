import { useState, type ChangeEvent } from "react";
import {
  type Resume,
  type ResumeBasicInfo,
  type ResumeEducationItem,
  type ResumeExperienceItem,
} from "../../domain/resume";
import { parseResumeSections } from "../../application/parseResumeSections";
import { finalizeExperienceAchievements } from "../../shared/experienceAchievements";
import { type ScanJobPageResult } from "../../application/scanJobPage";
import { type AiProviderId } from "../../infrastructure/ai/openAiJobInsightsExtractor";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  TailorAiRewriterDialog,
  type TailorAiRewriteOpenPayload,
} from "../components/TailorAiRewriterDialog";
import { getVisibleTailorSections } from "./tailorSectionModel";
import { TailorSectionPanels } from "./TailorSectionPanels";
import { TailorResumePdfPreviewModal } from "../components/TailorResumePdfPreviewModal";
import { TailorTailoredPdfPreviewModal } from "../components/TailorTailoredPdfPreviewModal";
import type { GenerateResumePdfInput, ResumePdfTemplateId } from "../../infrastructure/pdf/resumePdfTypes";
import { isResumePdfTemplateId, RESUME_PDF_TEMPLATES } from "../../infrastructure/pdf/resumePdfTypes";

type TailorPageProps = {
  apiKey: string;
  aiProvider: AiProviderId;
  job: ScanJobPageResult | null;
  resume: Resume | null;
  onBack: () => void;
  onOpenSettings: () => void;
  onNext: () => void;
  onResumeChange: (resume: Resume) => void;
};

const emptyEducationItem: ResumeEducationItem = {
  id: "education-1",
  degree: "",
  school: "",
  dates: "",
  details: "",
};

const emptyBasicInfo: ResumeBasicInfo = {
  name: "",
  email: "",
  phone: "",
  location: "",
  links: [],
};

function compileResumeText(resume: Pick<
  Resume,
  | "basicInfo"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
>): string {
  return [
    resume.basicInfo,
    resume.summary,
    resume.skills,
    resume.experience,
    resume.projects,
    resume.education,
    resume.certifications,
  ]
    .filter(Boolean)
    .join("\n\n");
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

function splitSkillChips(skills?: string) {
  return (skills ?? "")
    .split(/[,;\n|]+/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function joinSkillChips(skills: string[]) {
  return skills.join(", ");
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

function formatEducationItems(items: ResumeEducationItem[]) {
  return items
    .map((item) =>
      [item.degree, item.school, item.dates, item.details]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function calculateMatchScore(resume: Resume | null, keywords: string[]) {
  if (!resume || !keywords.length) {
    return 0;
  }

  const normalizedResume = resume.rawText.toLowerCase();
  const matchedCount = keywords.filter((keyword) =>
    normalizedResume.includes(keyword.toLowerCase()),
  ).length;

  return Math.round((matchedCount / keywords.length) * 100);
}

function getKeywordTexts(job: ScanJobPageResult | null) {
  return (job?.keywords ?? []).map((keyword) => keyword.text).filter(Boolean);
}

function parseBasicInfoFallback(basicInfo?: string): ResumeBasicInfo {
  if (!basicInfo?.trim()) {
    return emptyBasicInfo;
  }

  const lines = basicInfo
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const joinedText = lines.join(" ");
  const email = joinedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone =
    joinedText.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{3,4}/)?.[0] ??
    "";
  const location =
    joinedText.match(
      /[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,?\s+(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+\d{4},?\s+Australia/i,
    )?.[0] ?? "";
  const links = joinedText
    .split(/[,|]+/)
    .map((part) => part.trim())
    .filter((part) => /linkedin|github|portfolio|https?:\/\/|www\./i.test(part));
  const name =
    lines.find((line) => !line.includes("@") && !/\d{4}/.test(line)) ??
    joinedText.split(email || phone || "|")[0];

  return {
    name: name.replace(phone, "").replace(email, "").replace(/\|/g, " ").trim(),
    email,
    phone,
    location,
    links,
  };
}

function enrichResumeSections(resume: Resume | null) {
  if (!resume) {
    return null;
  }

  const parsedSections = parseResumeSections(resume.rawText);

  const experienceItemsRaw =
    resume.experienceItems?.length ? resume.experienceItems : parsedSections.experienceItems;

  const experienceItems = experienceItemsRaw.map((item) => ({
    ...item,
    achievements: finalizeExperienceAchievements(
      item.achievements,
      item.title,
      item.location,
    ),
  }));

  const nextExperienceString = resume.experienceItems?.length
    ? formatExperienceItems(experienceItems)
    : resume.experience || parsedSections.experience;

  const shouldReparseEducation = !resume.educationItems?.length;
  const shouldReparseBasicInfo = !resume.basicInfoFields;

  if (!shouldReparseEducation && !shouldReparseBasicInfo && resume.experienceItems?.length) {
    return {
      ...resume,
      experienceItems,
      experience: nextExperienceString,
    };
  }

  return {
    ...resume,
    basicInfoFields: resume.basicInfoFields ?? parsedSections.basicInfoFields,
    experience: nextExperienceString,
    experienceItems,
    education: resume.education || parsedSections.education,
    educationItems: resume.educationItems?.length
      ? resume.educationItems
      : parsedSections.educationItems,
  };
}

function buildParsedResumeDebugJson(resume: Resume) {
  return {
    title: resume.title,
    parseStatus: resume.parseStatus,
    parseSource: resume.parseSource,
    parsedAt: resume.parsedAt,
    parserVersion: resume.parserVersion,
    basicInfo: resume.basicInfoFields,
    summary: resume.summary,
    skills: splitSkillChips(resume.skills),
    experienceItems: resume.experienceItems ?? [],
    projectItems: resume.projectItems ?? [],
    educationItems: resume.educationItems ?? [],
    certifications: resume.certifications
      ? resume.certifications.split(/\n+/).filter(Boolean)
      : [],
  };
}

export function TailorPage({
  apiKey,
  aiProvider,
  job,
  resume,
  onBack,
  onOpenSettings,
  onNext,
  onResumeChange,
}: TailorPageProps) {
  const activeResume = enrichResumeSections(resume);
  const hasApiKey = Boolean(apiKey.trim());
  const [rewriterPayload, setRewriterPayload] = useState<TailorAiRewriteOpenPayload | null>(null);
  const [bundledTemplatePreviewOpen, setBundledTemplatePreviewOpen] = useState(false);
  const [tailoredPdfPreviewOpen, setTailoredPdfPreviewOpen] = useState(false);
  const [tailoredPdfLayout, setTailoredPdfLayout] = useState<ResumePdfTemplateId>("professional");
  const [tailoredPdfBusy, setTailoredPdfBusy] = useState(false);
  const matchKeywords = getKeywordTexts(job).slice(0, 8);
  const basicInfoFields =
    activeResume?.basicInfoFields ?? parseBasicInfoFallback(activeResume?.basicInfo);
  const selectedSkills = splitSkillChips(activeResume?.skills);
  const educationItems =
    activeResume?.educationItems?.length ? activeResume.educationItems : [emptyEducationItem];
  const matchScore = calculateMatchScore(activeResume, matchKeywords);
  const displayedScore = matchScore || (activeResume ? 72 : 0);

  const visibleTailorSections = activeResume
    ? getVisibleTailorSections(activeResume, selectedSkills)
    : [];

  const pdfInput: GenerateResumePdfInput | null = activeResume
    ? {
        resume: activeResume,
        basicInfo: basicInfoFields,
        educationItems,
        selectedSkills,
      }
    : null;

  function handleTailoredLayoutChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (isResumePdfTemplateId(next)) {
      setTailoredPdfLayout(next);
    }
  }

  async function handleDownloadTailoredPdf() {
    if (!pdfInput) {
      return;
    }

    setTailoredPdfBusy(true);
    try {
      const { generateResumePdfBlob } = await import("../../infrastructure/pdf/generateResumePdf");
      const blob = await generateResumePdfBlob(pdfInput, tailoredPdfLayout);
      const url = URL.createObjectURL(blob);
      const raw = pdfInput.basicInfo.name.trim() || pdfInput.resume.title || "resume";
      const slug = raw
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug || "resume"}-${tailoredPdfLayout}.pdf`;
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setTailoredPdfBusy(false);
    }
  }

  function handleOpenAiRewrite(payload: TailorAiRewriteOpenPayload) {
    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }

    setRewriterPayload(payload);
  }

  function handleCloseRewriter() {
    setRewriterPayload(null);
  }

  function handleApplyRewriter(rewritten: string) {
    if (!rewriterPayload) {
      return;
    }

    if (rewriterPayload.kind === "summary") {
      updateResumeSection("summary", rewritten);
    } else {
      updateExperienceAchievement(
        rewriterPayload.itemId,
        rewriterPayload.achievementIndex,
        rewritten,
      );
    }

    handleCloseRewriter();
  }

  function saveResume(nextResume: Resume) {
    onResumeChange({
      ...nextResume,
      rawText: compileResumeText(nextResume),
      updatedAt: new Date().toISOString(),
    });
  }

  function updateResumeSection(
    section:
      | "basicInfo"
      | "summary"
      | "skills"
      | "experience"
      | "projects"
      | "education"
      | "certifications",
    value: string,
  ) {
    if (!activeResume) {
      return;
    }

    saveResume({
      ...activeResume,
      [section]: value,
    });
  }

  function updateBasicInfoField(
    field: "name" | "email" | "phone" | "location",
    value: string,
  ) {
    if (!activeResume) {
      return;
    }

    const nextBasicInfoFields = {
      ...basicInfoFields,
      [field]: value,
    };

    saveResume({
      ...activeResume,
      basicInfo: formatBasicInfo(nextBasicInfoFields),
      basicInfoFields: nextBasicInfoFields,
    });
  }

  function updateBasicInfoLinks(value: string) {
    if (!activeResume) {
      return;
    }

    const nextBasicInfoFields = {
      ...basicInfoFields,
      links: value
        .split(/[,|]+/)
        .map((link) => link.trim())
        .filter(Boolean),
    };

    saveResume({
      ...activeResume,
      basicInfo: formatBasicInfo(nextBasicInfoFields),
      basicInfoFields: nextBasicInfoFields,
    });
  }

  function updateSkill(index: number, value: string) {
    if (!activeResume) {
      return;
    }

    const nextSkills = selectedSkills.map((skill, skillIndex) =>
      skillIndex === index ? value : skill,
    );

    saveResume({
      ...activeResume,
      skills: joinSkillChips(nextSkills),
    });
  }

  function addSkill() {
    if (!activeResume) {
      return;
    }

    saveResume({
      ...activeResume,
      skills: joinSkillChips([...selectedSkills, "New skill"]),
    });
  }

  function updateExperienceItem(
    itemId: string,
    field: "title" | "company" | "dates" | "location",
    value: string,
  ) {
    if (!activeResume) {
      return;
    }

    const experienceItems = (activeResume.experienceItems ?? []).map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item,
    );

    saveResume({
      ...activeResume,
      experience: formatExperienceItems(experienceItems),
      experienceItems,
    });
  }

  function updateExperienceAchievement(
    itemId: string,
    achievementIndex: number,
    value: string,
  ) {
    if (!activeResume) {
      return;
    }

    const experienceItems = (activeResume.experienceItems ?? []).map((item) =>
      item.id === itemId
        ? {
            ...item,
            achievements: item.achievements.map((achievement, index) =>
              index === achievementIndex ? value : achievement,
            ),
          }
        : item,
    );

    saveResume({
      ...activeResume,
      experience: formatExperienceItems(experienceItems),
      experienceItems,
    });
  }

  function updateEducationItem(
    itemId: string,
    field: "degree" | "school" | "dates" | "details",
    value: string,
  ) {
    if (!activeResume) {
      return;
    }

    const existingItems =
      activeResume.educationItems?.length ? activeResume.educationItems : [emptyEducationItem];
    const educationItems = existingItems.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item,
    );

    saveResume({
      ...activeResume,
      education: formatEducationItems(educationItems),
      educationItems,
    });
  }

  function clearEntireSection(
    section:
      | "basicInfo"
      | "summary"
      | "skills"
      | "experience"
      | "projects"
      | "education"
      | "certifications",
  ) {
    if (!activeResume) {
      return;
    }

    if (section === "basicInfo") {
      saveResume({
        ...activeResume,
        basicInfo: "",
        basicInfoFields: { ...emptyBasicInfo, links: [] },
      });
      return;
    }

    if (section === "summary") {
      saveResume({ ...activeResume, summary: "" });
      return;
    }

    if (section === "skills") {
      saveResume({ ...activeResume, skills: "" });
      return;
    }

    if (section === "experience") {
      saveResume({
        ...activeResume,
        experience: "",
        experienceItems: [],
      });
      return;
    }

    if (section === "projects") {
      saveResume({
        ...activeResume,
        projects: "",
        projectItems: [],
      });
      return;
    }

    if (section === "education") {
      saveResume({
        ...activeResume,
        education: "",
        educationItems: [],
      });
      return;
    }

    saveResume({ ...activeResume, certifications: "" });
  }

  function removeExperienceItem(itemId: string) {
    if (!activeResume) {
      return;
    }

    const experienceItems = (activeResume.experienceItems ?? []).filter(
      (item) => item.id !== itemId,
    );

    saveResume({
      ...activeResume,
      experience: formatExperienceItems(experienceItems),
      experienceItems,
    });
  }

  function removeEducationItem(itemId: string) {
    if (!activeResume) {
      return;
    }

    const existingItems = activeResume.educationItems?.length
      ? activeResume.educationItems
      : [];
    const educationItems = existingItems.filter((item) => item.id !== itemId);

    saveResume({
      ...activeResume,
      education: educationItems.length ? formatEducationItems(educationItems) : "",
      educationItems,
    });
  }

  function removeSkillAt(skillIndex: number) {
    if (!activeResume) {
      return;
    }

    const nextSkills = selectedSkills.filter((_, index) => index !== skillIndex);

    saveResume({
      ...activeResume,
      skills: joinSkillChips(nextSkills),
    });
  }

  function removeExperienceAchievement(itemId: string, achievementIndex: number) {
    if (!activeResume) {
      return;
    }

    const experienceItems = (activeResume.experienceItems ?? []).map((item) =>
      item.id === itemId
        ? {
            ...item,
            achievements: item.achievements.filter((_, index) => index !== achievementIndex),
          }
        : item,
    );

    saveResume({
      ...activeResume,
      experience: formatExperienceItems(experienceItems),
      experienceItems,
    });
  }

  if (!activeResume) {
    return (
      <main className="page stack">
        <section className="center stack">
          <h1>Tailored Resume</h1>
          <p className="muted">Select a resume before tailoring.</p>
        </section>
        <PrimaryButton type="button" variant="secondary" onClick={onBack}>
          Back to Resume
        </PrimaryButton>
      </main>
    );
  }

  return (
    <>
    <main className="page stack">
      <header className="tailor-hero">
        <div>
          <h1>Tailored Resume</h1>
          <p className="muted truncate-text">
            {basicInfoFields.name || activeResume.basicInfo?.split("\n")[0] || activeResume.title}
            {job?.title ? ` · ${job.title}` : ""}
          </p>
        </div>
        <span className="score-pill">{displayedScore}%</span>
      </header>

      {!hasApiKey ? (
        <Card tone="soft">
          <span className="eyebrow">API key required</span>
          <p>
            Add your API key in Settings to continue to the cover letter step and to use
            provider-backed features. If this resume was parsed before you saved a key, go back
            to Resume, add your key, and upload the PDF again for AI parsing.
          </p>
          <PrimaryButton type="button" variant="secondary" onClick={onOpenSettings}>
            Open Settings
          </PrimaryButton>
        </Card>
      ) : activeResume.parseSource === "local" ? (
        <Card tone="soft">
          <span className="eyebrow">Local parse</span>
          <p className="helper-text">
            This resume was structured with local rules only. For AI-extracted sections, return
            to Resume and re-upload the PDF with your API key and provider selected.
          </p>
        </Card>
      ) : null}

      <Card tone="soft">
        <span className="eyebrow">Match Improvements</span>
        <div className="editable-chip-list">
          {matchKeywords.length ? (
            matchKeywords.map((keyword) => (
              <span className="editable-chip static-chip" key={keyword}>
                {keyword}
              </span>
            ))
          ) : (
            <p className="helper-text">Scan a job to see targeted keywords.</p>
          )}
        </div>
      </Card>

      <TailorSectionPanels
        visibleSections={visibleTailorSections}
        activeResume={activeResume}
        basicInfoFields={basicInfoFields}
        selectedSkills={selectedSkills}
        educationItems={educationItems}
        hasApiKey={hasApiKey}
        onOpenAiRewrite={handleOpenAiRewrite}
        updateBasicInfoField={updateBasicInfoField}
        updateBasicInfoLinks={updateBasicInfoLinks}
        updateResumeSection={updateResumeSection}
        updateSkill={updateSkill}
        addSkill={addSkill}
        updateExperienceItem={updateExperienceItem}
        updateExperienceAchievement={updateExperienceAchievement}
        updateEducationItem={updateEducationItem}
        removeExperienceItem={removeExperienceItem}
        removeEducationItem={removeEducationItem}
        removeSkillAt={removeSkillAt}
        removeExperienceAchievement={removeExperienceAchievement}
        clearEntireSection={clearEntireSection}
      />

      <Card>
        <details className="json-debug-panel" open>
          <summary>Parsed Resume JSON</summary>
          <p className="helper-text">
            Debug view of the structured resume data used by Tailor.
          </p>
          <pre>{JSON.stringify(buildParsedResumeDebugJson(activeResume), null, 2)}</pre>
        </details>
      </Card>

      <Card>
        <h2 className="tailor-pdf-trigger-title">Résumé PDF</h2>
        <p className="helper-text">
          <strong>Preview resume</strong> opens your tailored PDF (same @react-pdf output as
          download). <strong>Download tailored PDF</strong> saves that file. Optional: preview a
          static bundled template file for layout reference.
        </p>
        <div className="tailor-pdf-card-actions">
          <div className="tailor-pdf-tailored-row">
            <label className="field-label" htmlFor="tailor-tailored-pdf-layout">
              Data layout
            </label>
            <select
              id="tailor-tailored-pdf-layout"
              className="text-input tailor-pdf-template-select"
              value={tailoredPdfLayout}
              onChange={handleTailoredLayoutChange}
            >
              {RESUME_PDF_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button primary"
              disabled={!pdfInput}
              onClick={() => setTailoredPdfPreviewOpen(true)}
            >
              Preview resume
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={!pdfInput || tailoredPdfBusy}
              onClick={() => void handleDownloadTailoredPdf()}
            >
              {tailoredPdfBusy ? "Preparing…" : "Download tailored PDF"}
            </button>
            <button
              type="button"
              className="link-button tailor-pdf-bundled-link"
              onClick={() => setBundledTemplatePreviewOpen(true)}
            >
              Preview bundled template file…
            </button>
          </div>
        </div>
      </Card>

      <div className="footer-actions two-columns">
        <PrimaryButton type="button" variant="secondary" onClick={onBack}>
          Back
        </PrimaryButton>
        <PrimaryButton type="button" disabled={!hasApiKey} onClick={onNext}>
          Cover letter &gt;
        </PrimaryButton>
      </div>
    </main>

    {bundledTemplatePreviewOpen ? (
      <TailorResumePdfPreviewModal
        open={bundledTemplatePreviewOpen}
        onClose={() => setBundledTemplatePreviewOpen(false)}
      />
    ) : null}

    {tailoredPdfPreviewOpen ? (
      <TailorTailoredPdfPreviewModal
        open={tailoredPdfPreviewOpen}
        onClose={() => setTailoredPdfPreviewOpen(false)}
        input={pdfInput}
        inputVersion={activeResume?.updatedAt ?? ""}
        layoutId={tailoredPdfLayout}
        onLayoutChange={setTailoredPdfLayout}
        onDownloadTailored={() => void handleDownloadTailoredPdf()}
        downloadBusy={tailoredPdfBusy}
      />
    ) : null}

    {rewriterPayload ? (
      <TailorAiRewriterDialog
        key={
          rewriterPayload.kind === "summary"
            ? "rewrite-summary"
            : `rewrite-${rewriterPayload.itemId}-${rewriterPayload.achievementIndex}`
        }
        job={job}
        context={rewriterPayload}
        apiKey={apiKey}
        aiProvider={aiProvider}
        onClose={handleCloseRewriter}
        onApply={handleApplyRewriter}
        onOpenSettings={onOpenSettings}
      />
    ) : null}
    </>
  );
}
