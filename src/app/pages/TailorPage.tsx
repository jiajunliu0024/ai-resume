import {
  type Resume,
  type ResumeBasicInfo,
  type ResumeEducationItem,
  type ResumeExperienceItem,
} from "../../domain/resume";
import { parseResumeSections } from "../../application/parseResumeSections";
import { type ScanJobPageResult } from "../../application/scanJobPage";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";

type TailorPageProps = {
  job: ScanJobPageResult | null;
  resume: Resume | null;
  onBack: () => void;
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

  const shouldReparseExperience = !resume.experienceItems?.length;
  const shouldReparseEducation = !resume.educationItems?.length;
  const shouldReparseBasicInfo = !resume.basicInfoFields;

  if (!shouldReparseExperience && !shouldReparseEducation && !shouldReparseBasicInfo) {
    return resume;
  }

  const parsedSections = parseResumeSections(resume.rawText);

  return {
    ...resume,
    basicInfoFields: resume.basicInfoFields ?? parsedSections.basicInfoFields,
    experience: resume.experience || parsedSections.experience,
    experienceItems: resume.experienceItems?.length
      ? resume.experienceItems
      : parsedSections.experienceItems,
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
  job,
  resume,
  onBack,
  onNext,
  onResumeChange,
}: TailorPageProps) {
  const activeResume = enrichResumeSections(resume);
  const matchKeywords = getKeywordTexts(job).slice(0, 8);
  const basicInfoFields =
    activeResume?.basicInfoFields ?? parseBasicInfoFallback(activeResume?.basicInfo);
  const selectedSkills = splitSkillChips(activeResume?.skills);
  const educationItems =
    activeResume?.educationItems?.length ? activeResume.educationItems : [emptyEducationItem];
  const matchScore = calculateMatchScore(activeResume, matchKeywords);
  const displayedScore = matchScore || (activeResume ? 72 : 0);

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

      <Card tone="soft">
        <div className="section-header">
          <span className="eyebrow">Basic Info</span>
          <span className="fit">Editable</span>
        </div>
        <div className="basic-info-grid">
          <label className="editor-field-label">
            Name
            <input
              className="text-input"
              value={basicInfoFields.name}
              onChange={(event) =>
                updateBasicInfoField("name", event.target.value)
              }
            />
          </label>
          <label className="editor-field-label">
            Email
            <input
              className="text-input"
              value={basicInfoFields.email}
              onChange={(event) =>
                updateBasicInfoField("email", event.target.value)
              }
            />
          </label>
          <label className="editor-field-label">
            Phone
            <input
              className="text-input"
              value={basicInfoFields.phone}
              onChange={(event) =>
                updateBasicInfoField("phone", event.target.value)
              }
            />
          </label>
          <label className="editor-field-label">
            Location
            <input
              className="text-input"
              value={basicInfoFields.location}
              onChange={(event) =>
                updateBasicInfoField("location", event.target.value)
              }
            />
          </label>
          <label className="editor-field-label basic-info-wide">
            Links
            <input
              className="text-input"
              value={basicInfoFields.links.join(", ")}
              onChange={(event) => updateBasicInfoLinks(event.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card tone="soft">
        <div className="section-header">
          <span className="eyebrow">Skills</span>
          <button className="ai-enhance-button" type="button">
            AI Rewrite
          </button>
        </div>
        <div className="editable-chip-list">
          {selectedSkills.length ? (
            selectedSkills.map((skill, index) => (
              <input
                className="editable-chip"
                key={`${skill}-${index}`}
                value={skill}
                onChange={(event) => updateSkill(index, event.target.value)}
              />
            ))
          ) : (
            <p className="helper-text">No skills parsed yet.</p>
          )}
          <button className="chip add-skill-chip" type="button" onClick={addSkill}>
            + Skill
          </button>
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <h2>Summary</h2>
          <button className="ai-enhance-button" type="button">
            AI Rewrite
          </button>
        </div>
        <textarea
          className="textarea inline-edit-textarea"
          rows={5}
          placeholder="Professional summary..."
          value={activeResume.summary ?? ""}
          onChange={(event) => updateResumeSection("summary", event.target.value)}
        />
      </Card>

      <Card>
        <div className="section-header">
          <h2>Experience</h2>
          <button className="ai-enhance-button" type="button">
            AI Rewrite
          </button>
        </div>
        {activeResume.experienceItems?.length ? (
          <div className="resume-item-list">
            {activeResume.experienceItems.map((item) => (
              <div className="resume-edit-card" key={item.id}>
                <div className="editor-field-grid">
                  <label className="editor-field-label">
                    Job Title
                    <input
                      className="text-input"
                      value={item.title}
                      onChange={(event) =>
                        updateExperienceItem(item.id, "title", event.target.value)
                      }
                    />
                  </label>
                  <label className="editor-field-label">
                    Company
                    <input
                      className="text-input"
                      value={item.company}
                      onChange={(event) =>
                        updateExperienceItem(item.id, "company", event.target.value)
                      }
                    />
                  </label>
                  <label className="editor-field-label">
                    Dates
                    <input
                      className="text-input"
                      value={item.dates}
                      onChange={(event) =>
                        updateExperienceItem(item.id, "dates", event.target.value)
                      }
                    />
                  </label>
                  <label className="editor-field-label">
                    Location
                    <input
                      className="text-input"
                      value={item.location}
                      onChange={(event) =>
                        updateExperienceItem(
                          item.id,
                          "location",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
                <div className="achievement-list">
                  <span className="editor-field-label">Achievements</span>
                  {item.achievements.map((achievement, index) => (
                    <textarea
                      className="textarea inline-edit-textarea compact-textarea"
                      key={`${item.id}-${index}`}
                      value={achievement}
                      onChange={(event) =>
                        updateExperienceAchievement(
                          item.id,
                          index,
                          event.target.value,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <textarea
            className="textarea inline-edit-textarea"
            rows={8}
            value={activeResume.experience ?? ""}
            onChange={(event) =>
              updateResumeSection("experience", event.target.value)
            }
          />
        )}
      </Card>

      <Card>
        <div className="section-header">
          <h2>Projects</h2>
          <button className="ai-enhance-button" type="button">
            AI Rewrite
          </button>
        </div>
        <textarea
          className="textarea inline-edit-textarea"
          rows={7}
          placeholder="Project name, technologies, responsibilities, outcomes..."
          value={activeResume.projects ?? ""}
          onChange={(event) => updateResumeSection("projects", event.target.value)}
        />
      </Card>

      <Card>
        <div className="section-header">
          <h2>Education</h2>
          <button className="ai-enhance-button" type="button">
            AI Rewrite
          </button>
        </div>
        <div className="resume-item-list">
          {educationItems.map((item) => (
            <div className="resume-edit-card" key={item.id}>
              <div className="editor-field-grid">
                <label className="editor-field-label">
                  Degree
                  <input
                    className="text-input"
                    value={item.degree}
                    onChange={(event) =>
                      updateEducationItem(item.id, "degree", event.target.value)
                    }
                  />
                </label>
                <label className="editor-field-label">
                  School
                  <input
                    className="text-input"
                    value={item.school}
                    onChange={(event) =>
                      updateEducationItem(item.id, "school", event.target.value)
                    }
                  />
                </label>
                <label className="editor-field-label">
                  Dates
                  <input
                    className="text-input"
                    value={item.dates}
                    onChange={(event) =>
                      updateEducationItem(item.id, "dates", event.target.value)
                    }
                  />
                </label>
              </div>
              <textarea
                className="textarea inline-edit-textarea compact-textarea"
                placeholder="Courses, awards, notes..."
                value={item.details}
                onChange={(event) =>
                  updateEducationItem(item.id, "details", event.target.value)
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <h2>Certifications</h2>
          <button className="ai-enhance-button" type="button">
            AI Rewrite
          </button>
        </div>
        <textarea
          className="textarea inline-edit-textarea compact-textarea"
          placeholder="Certificates, licenses, awards..."
          value={activeResume.certifications ?? ""}
          onChange={(event) =>
            updateResumeSection("certifications", event.target.value)
          }
        />
      </Card>

      <Card>
        <details className="json-debug-panel" open>
          <summary>Parsed Resume JSON</summary>
          <p className="helper-text">
            Debug view of the structured resume data used by Tailor.
          </p>
          <pre>{JSON.stringify(buildParsedResumeDebugJson(activeResume), null, 2)}</pre>
        </details>
      </Card>

      <div className="footer-actions two-columns">
        <PrimaryButton type="button" variant="secondary" onClick={onBack}>
          Back
        </PrimaryButton>
        <PrimaryButton type="button" onClick={onNext}>
          Generate Cover Letter &gt;
        </PrimaryButton>
      </div>
    </main>
  );
}
