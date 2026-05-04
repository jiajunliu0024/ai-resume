import { useEffect, useRef, useState } from "react";
import { Card } from "../components/Card";
import {
  type Resume,
  type ResumeBasicInfo,
  type ResumeEducationItem,
} from "../../domain/resume";
import {
  type TailorSectionId,
  TAILOR_SECTION_LABELS,
  previewSnippet,
} from "./tailorSectionModel";

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

type TailorModalState =
  | { kind: "closed" }
  | { kind: "section"; section: TailorSectionId }
  | { kind: "experience"; itemId: string }
  | { kind: "education"; itemId: string };

export type TailorSectionPanelsProps = {
  visibleSections: TailorSectionId[];
  activeResume: Resume;
  basicInfoFields: ResumeBasicInfo;
  selectedSkills: string[];
  educationItems: ResumeEducationItem[];
  updateBasicInfoField: (
    field: "name" | "email" | "phone" | "location",
    value: string,
  ) => void;
  updateBasicInfoLinks: (value: string) => void;
  updateResumeSection: (
    section:
      | "basicInfo"
      | "summary"
      | "skills"
      | "experience"
      | "projects"
      | "education"
      | "certifications",
    value: string,
  ) => void;
  updateSkill: (index: number, value: string) => void;
  addSkill: () => void;
  updateExperienceItem: (
    itemId: string,
    field: "title" | "company" | "dates" | "location",
    value: string,
  ) => void;
  updateExperienceAchievement: (
    itemId: string,
    achievementIndex: number,
    value: string,
  ) => void;
  updateEducationItem: (
    itemId: string,
    field: "degree" | "school" | "dates" | "details",
    value: string,
  ) => void;
  removeExperienceItem: (itemId: string) => void;
  removeEducationItem: (itemId: string) => void;
  removeSkillAt: (skillIndex: number) => void;
  removeExperienceAchievement: (itemId: string, achievementIndex: number) => void;
  clearEntireSection: (
    section:
      | "basicInfo"
      | "summary"
      | "skills"
      | "experience"
      | "projects"
      | "education"
      | "certifications",
  ) => void;
};

const ACHIEVEMENT_SNIPPET_LEN = 110;
const EDUCATION_DETAILS_SNIPPET_LEN = 120;

export function TailorSectionPanels({
  visibleSections,
  activeResume,
  basicInfoFields,
  selectedSkills,
  educationItems,
  updateBasicInfoField,
  updateBasicInfoLinks,
  updateResumeSection,
  updateSkill,
  addSkill,
  updateExperienceItem,
  updateExperienceAchievement,
  updateEducationItem,
  removeExperienceItem,
  removeEducationItem,
  removeSkillAt,
  removeExperienceAchievement,
  clearEntireSection,
}: TailorSectionPanelsProps) {
  const [modal, setModal] = useState<TailorModalState>({ kind: "closed" });
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (modal.kind === "closed") {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  }, [modal]);

  function closeModal() {
    dialogRef.current?.close();
  }

  function modalTitle(): string {
    if (modal.kind === "closed") {
      return "";
    }

    if (modal.kind === "section") {
      return `Edit ${TAILOR_SECTION_LABELS[modal.section]}`;
    }

    if (modal.kind === "experience") {
      const item = activeResume.experienceItems?.find((entry) => entry.id === modal.itemId);
      return item?.title?.trim() ? `Edit · ${item.title}` : "Edit experience";
    }

    const edu = educationItems.find((entry) => entry.id === modal.itemId);
    return edu?.degree?.trim() ? `Edit · ${edu.degree}` : "Edit education";
  }

  function renderModalBody() {
    if (modal.kind === "closed") {
      return null;
    }

    if (modal.kind === "section") {
      const { section } = modal;

      if (section === "basicInfo") {
        return (
          <div className="basic-info-grid tailor-section-editor">
            <label className="editor-field-label">
              Name
              <input
                className="text-input"
                value={basicInfoFields.name}
                onChange={(event) => updateBasicInfoField("name", event.target.value)}
              />
            </label>
            <label className="editor-field-label">
              Email
              <input
                className="text-input"
                value={basicInfoFields.email}
                onChange={(event) => updateBasicInfoField("email", event.target.value)}
              />
            </label>
            <label className="editor-field-label">
              Phone
              <input
                className="text-input"
                value={basicInfoFields.phone}
                onChange={(event) => updateBasicInfoField("phone", event.target.value)}
              />
            </label>
            <label className="editor-field-label">
              Location
              <input
                className="text-input"
                value={basicInfoFields.location}
                onChange={(event) => updateBasicInfoField("location", event.target.value)}
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
        );
      }

      if (section === "skills") {
        return (
          <div className="tailor-section-editor">
            <div className="editable-chip-list skills-chip-list">
              {selectedSkills.length ? (
                selectedSkills.map((skill, index) => (
                  <div className="skill-chip-row" key={`${skill}-${index}`}>
                    <input
                      className="editable-chip skill-chip-input"
                      value={skill}
                      size={Math.max(8, Math.min(skill.length + 2, 48))}
                      onChange={(event) => updateSkill(index, event.target.value)}
                    />
                    <button
                      type="button"
                      className="chip-delete-button"
                      aria-label={`Remove skill ${skill}`}
                      onClick={() => removeSkillAt(index)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))
              ) : (
                <p className="helper-text">No skills yet. Add below.</p>
              )}
              <button className="chip add-skill-chip" type="button" onClick={addSkill}>
                + Skill
              </button>
            </div>
          </div>
        );
      }

      if (section === "summary") {
        return (
          <div className="tailor-section-editor">
            <textarea
              className="textarea inline-edit-textarea tailor-textarea-compact"
              rows={8}
              placeholder="Professional summary..."
              value={activeResume.summary ?? ""}
              onChange={(event) => updateResumeSection("summary", event.target.value)}
            />
          </div>
        );
      }

      if (section === "experience") {
        return (
          <div className="tailor-section-editor">
            <textarea
              className="textarea inline-edit-textarea tailor-textarea-compact"
              rows={12}
              placeholder="Paste or edit experience text..."
              value={activeResume.experience ?? ""}
              onChange={(event) => updateResumeSection("experience", event.target.value)}
            />
          </div>
        );
      }

      if (section === "projects") {
        return (
          <div className="tailor-section-editor">
            <textarea
              className="textarea inline-edit-textarea tailor-textarea-compact"
              rows={8}
              placeholder="Project name, technologies, responsibilities, outcomes..."
              value={activeResume.projects ?? ""}
              onChange={(event) => updateResumeSection("projects", event.target.value)}
            />
          </div>
        );
      }

      if (section === "education") {
        return (
          <div className="tailor-section-editor">
            <div className="resume-item-list">
              {educationItems.map((item) => (
                <div className="resume-edit-card" key={item.id}>
                  <div className="resume-edit-card-header">
                    <button
                      type="button"
                      className="section-delete-button"
                      aria-label="Remove this education entry"
                      onClick={() => removeEducationItem(item.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
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
                    className="textarea inline-edit-textarea compact-textarea tailor-achievement-textarea"
                    placeholder="Courses, awards, notes..."
                    value={item.details}
                    onChange={(event) =>
                      updateEducationItem(item.id, "details", event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (section === "certifications") {
        return (
          <div className="tailor-section-editor">
            <textarea
              className="textarea inline-edit-textarea compact-textarea tailor-achievement-textarea"
              rows={8}
              placeholder="Certificates, licenses, awards..."
              value={activeResume.certifications ?? ""}
              onChange={(event) =>
                updateResumeSection("certifications", event.target.value)
              }
            />
          </div>
        );
      }
    }

    if (modal.kind === "experience") {
      const item = activeResume.experienceItems?.find((entry) => entry.id === modal.itemId);
      if (!item) {
        return <p className="helper-text">This experience entry is no longer available.</p>;
      }

      return (
        <div className="tailor-section-editor">
          <div className="resume-edit-card">
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
                    updateExperienceItem(item.id, "location", event.target.value)
                  }
                />
              </label>
            </div>
            <div className="achievement-list">
              <span className="editor-field-label">Achievements</span>
              {item.achievements.map((achievement, index) => (
                <div className="achievement-row" key={`${item.id}-${index}`}>
                  <textarea
                    className="textarea inline-edit-textarea compact-textarea tailor-achievement-textarea"
                    value={achievement}
                    onChange={(event) =>
                      updateExperienceAchievement(item.id, index, event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="chip-delete-button"
                    aria-label="Remove this achievement"
                    onClick={() => removeExperienceAchievement(item.id, index)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (modal.kind === "education") {
      const eduItem = educationItems.find((entry) => entry.id === modal.itemId);
      if (!eduItem) {
        return <p className="helper-text">This education entry is no longer available.</p>;
      }

      return (
        <div className="tailor-section-editor">
          <div className="resume-edit-card">
            <div className="editor-field-grid">
              <label className="editor-field-label">
                Degree
                <input
                  className="text-input"
                  value={eduItem.degree}
                  onChange={(event) =>
                    updateEducationItem(eduItem.id, "degree", event.target.value)
                  }
                />
              </label>
              <label className="editor-field-label">
                School
                <input
                  className="text-input"
                  value={eduItem.school}
                  onChange={(event) =>
                    updateEducationItem(eduItem.id, "school", event.target.value)
                  }
                />
              </label>
              <label className="editor-field-label">
                Dates
                <input
                  className="text-input"
                  value={eduItem.dates}
                  onChange={(event) =>
                    updateEducationItem(eduItem.id, "dates", event.target.value)
                  }
                />
              </label>
            </div>
            <textarea
              className="textarea inline-edit-textarea compact-textarea tailor-achievement-textarea"
              placeholder="Courses, awards, notes..."
              value={eduItem.details}
              onChange={(event) =>
                updateEducationItem(eduItem.id, "details", event.target.value)
              }
            />
          </div>
        </div>
      );
    }

    return null;
  }

  function sectionHeaderActions(sectionId: TailorSectionId, label: string) {
    const clearButton = (
      <button
        type="button"
        className="section-delete-button"
        aria-label={`Clear ${label}`}
        onClick={() => clearEntireSection(sectionId)}
      >
        <TrashIcon />
      </button>
    );

    if (sectionId === "experience" || sectionId === "education") {
      return <div className="section-header-actions">{clearButton}</div>;
    }

    return (
      <div className="section-header-actions">
        <button
          type="button"
          className="icon-only-button"
          aria-label={`Edit ${label}`}
          onClick={() => setModal({ kind: "section", section: sectionId })}
        >
          <PencilIcon />
        </button>
        {clearButton}
      </div>
    );
  }

  return (
    <>
      {visibleSections.map((sectionId) => {
        const label = TAILOR_SECTION_LABELS[sectionId];
        const softTone = sectionId === "basicInfo" || sectionId === "skills";
        const headerActions = sectionHeaderActions(sectionId, label);

        if (sectionId === "basicInfo") {
          const contactLine = [basicInfoFields.name, basicInfoFields.email, basicInfoFields.phone]
            .filter(Boolean)
            .join(" · ");

          return (
            <Card key={sectionId} tone={softTone ? "soft" : "default"}>
              <div className="section-header">
                <span className="eyebrow">{label}</span>
                {headerActions}
              </div>
              <div className="tailor-section-preview">
                <p className="tailor-preview-line tailor-preview-snippet" title={contactLine}>
                  {contactLine ?
                    previewSnippet(contactLine, 140)
                  : <span className="muted">No contact details yet.</span>}
                </p>
                {basicInfoFields.location ? (
                  <p className="muted tailor-preview-meta" title={basicInfoFields.location}>
                    {previewSnippet(basicInfoFields.location, 80)}
                  </p>
                ) : null}
                {basicInfoFields.links.length ? (
                  <p
                    className="muted tailor-preview-meta tailor-preview-snippet"
                    title={basicInfoFields.links.join(" · ")}
                  >
                    {previewSnippet(basicInfoFields.links.join(" · "), 120)}
                  </p>
                ) : null}
              </div>
            </Card>
          );
        }

        if (sectionId === "skills") {
          return (
            <Card key={sectionId} tone="soft">
              <div className="section-header">
                <span className="eyebrow">{label}</span>
                {headerActions}
              </div>
              <div className="tailor-section-preview">
                <div className="editable-chip-list skills-chip-list">
                  {selectedSkills.map((skill, index) => (
                    <span className="chip" key={`${skill}-${index}`} title={skill}>
                      {previewSnippet(skill, 32)}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          );
        }

        if (sectionId === "summary") {
          return (
            <Card key={sectionId}>
              <div className="section-header">
                <h2>{label}</h2>
                {headerActions}
              </div>
              <div
                className="tailor-section-preview preview-text tailor-preview-snippet"
                title={activeResume.summary?.trim() ?? ""}
              >
                {activeResume.summary?.trim() ? (
                  previewSnippet(activeResume.summary, 280)
                ) : (
                  <span className="muted">Empty summary.</span>
                )}
              </div>
            </Card>
          );
        }

        if (sectionId === "experience") {
          return (
            <Card key={sectionId}>
              <div className="section-header">
                <h2>{label}</h2>
                {headerActions}
              </div>
              <div className="tailor-section-preview">
                {activeResume.experienceItems?.length ? (
                  <div className="tailor-preview-block">
                    {activeResume.experienceItems.map((item) => (
                      <div className="tailor-experience-preview-card" key={item.id}>
                        <div className="tailor-experience-preview-head">
                          <div>
                            <p className="tailor-preview-line">
                              <strong>{item.title || "Role"}</strong>
                              <span className="muted">
                                {" "}
                                {item.company ? `· ${item.company}` : ""}{" "}
                                {item.dates ? `· ${item.dates}` : ""}
                              </span>
                            </p>
                            {item.location ? (
                              <p className="muted tailor-preview-meta">{item.location}</p>
                            ) : null}
                          </div>
                          <div className="tailor-card-actions">
                            <button
                              type="button"
                              className="icon-only-button"
                              aria-label={`Edit ${item.title || "experience"}`}
                              onClick={() => setModal({ kind: "experience", itemId: item.id })}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              className="section-delete-button"
                              aria-label="Remove this experience entry"
                              onClick={() => removeExperienceItem(item.id)}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                        {item.achievements.length ? (
                          <ul className="tailor-achievement-snippet-list">
                            {item.achievements.map((achievement, index) => (
                              <li
                                key={`${item.id}-a-${index}`}
                                className="tailor-achievement-snippet"
                                title={achievement}
                              >
                                {previewSnippet(achievement, ACHIEVEMENT_SNIPPET_LEN)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tailor-experience-fallback-preview">
                    <p
                      className="preview-text tailor-preview-snippet"
                      title={activeResume.experience ?? ""}
                    >
                      {previewSnippet(activeResume.experience ?? "", 360) || (
                        <span className="muted">No experience text.</span>
                      )}
                    </p>
                    <button
                      type="button"
                      className="section-edit-button"
                      onClick={() => setModal({ kind: "section", section: "experience" })}
                    >
                      Edit text
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        }

        if (sectionId === "projects") {
          const projectPreview =
            activeResume.projectItems?.length ?
              activeResume.projectItems
                .map((project) => project.name || previewSnippet(project.description, 80))
                .filter(Boolean)
                .join(" · ")
            : previewSnippet(activeResume.projects ?? "", 360);

          const projectFull =
            activeResume.projectItems?.length ?
              activeResume.projectItems
                .map((p) => [p.name, p.description].filter(Boolean).join(": "))
                .join("\n")
            : (activeResume.projects ?? "");

          return (
            <Card key={sectionId}>
              <div className="section-header">
                <h2>{label}</h2>
                {headerActions}
              </div>
              <div
                className="tailor-section-preview preview-text tailor-preview-snippet"
                title={projectFull.trim()}
              >
                {projectPreview || <span className="muted">No projects.</span>}
              </div>
            </Card>
          );
        }

        if (sectionId === "education") {
          return (
            <Card key={sectionId}>
              <div className="section-header">
                <h2>{label}</h2>
                {headerActions}
              </div>
              <div className="tailor-section-preview tailor-preview-block">
                {educationItems.map((item) => (
                  <div className="tailor-education-preview-card" key={item.id}>
                    <div className="tailor-experience-preview-head">
                      <div>
                        <p className="tailor-preview-line">
                          <strong>{item.degree || "Degree"}</strong>
                          <span className="muted">
                            {" "}
                            {item.school ? `· ${item.school}` : ""}{" "}
                            {item.dates ? `· ${item.dates}` : ""}
                          </span>
                        </p>
                        {item.details.trim() ? (
                          <p
                            className="tailor-education-details-snippet muted"
                            title={item.details}
                          >
                            {previewSnippet(item.details, EDUCATION_DETAILS_SNIPPET_LEN)}
                          </p>
                        ) : null}
                      </div>
                      <div className="tailor-card-actions">
                        <button
                          type="button"
                          className="icon-only-button"
                          aria-label={`Edit ${item.degree || "education"}`}
                          onClick={() => setModal({ kind: "education", itemId: item.id })}
                        >
                          <PencilIcon />
                        </button>
                        {activeResume.educationItems?.length ? (
                          <button
                            type="button"
                            className="section-delete-button"
                            aria-label="Remove this education entry"
                            onClick={() => removeEducationItem(item.id)}
                          >
                            <TrashIcon />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        }

        if (sectionId === "certifications") {
          const certText = activeResume.certifications?.trim() ?? "";
          return (
            <Card key={sectionId}>
              <div className="section-header">
                <h2>{label}</h2>
                {headerActions}
              </div>
              <div
                className="tailor-section-preview preview-text tailor-preview-snippet"
                title={certText}
              >
                {certText ? (
                  previewSnippet(certText, 280)
                ) : (
                  <span className="muted">No certifications.</span>
                )}
              </div>
            </Card>
          );
        }

        return null;
      })}

      <dialog
        ref={dialogRef}
        className="tailor-edit-dialog"
        onClose={() => setModal({ kind: "closed" })}
      >
        <div className="tailor-edit-dialog__panel">
          <header className="tailor-edit-dialog__header">
            <h3 className="tailor-edit-dialog__title">{modalTitle()}</h3>
            <button
              type="button"
              className="icon-only-button"
              aria-label="Close dialog"
              onClick={closeModal}
            >
              ×
            </button>
          </header>
          <div className="tailor-edit-dialog__body">{renderModalBody()}</div>
          <footer className="tailor-edit-dialog__footer">
            <button type="button" className="section-edit-button" onClick={closeModal}>
              Close
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
