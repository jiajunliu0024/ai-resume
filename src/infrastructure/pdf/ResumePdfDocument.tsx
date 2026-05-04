import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GenerateResumePdfInput, ResumePdfTemplateId } from "./resumePdfTypes";

type ResumePdfDocumentProps = {
  input: GenerateResumePdfInput;
  templateId: ResumePdfTemplateId;
};

function buildContactParts(basic: GenerateResumePdfInput["basicInfo"]): string[] {
  const parts: string[] = [];
  if (basic.phone.trim()) {
    parts.push(basic.phone.trim());
  }

  if (basic.email.trim()) {
    parts.push(basic.email.trim());
  }

  if (basic.location.trim()) {
    parts.push(basic.location.trim());
  }

  return parts;
}

function buildLinkLine(basic: GenerateResumePdfInput["basicInfo"]): string {
  return basic.links
    .map((link) => link.trim())
    .filter(Boolean)
    .join(" · ");
}

function createStyles(templateId: ResumePdfTemplateId) {
  const isModern = templateId === "modern";
  const isMinimal = templateId === "minimal";

  const primary = isMinimal ? "#475467" : "#073391";
  const bodyText = "#101828";
  const muted = "#667085";

  return StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      fontSize: 9.5,
      color: bodyText,
      paddingTop: isModern ? 0 : 36,
      paddingBottom: 40,
      paddingHorizontal: isModern ? 0 : 40,
    },
    hero: {
      backgroundColor: "#0f172a",
      paddingHorizontal: 40,
      paddingTop: 28,
      paddingBottom: 20,
      marginBottom: 16,
    },
    heroName: {
      color: "#f8fafc",
      fontSize: 22,
      fontFamily: "Helvetica-Bold",
      marginBottom: 6,
    },
    heroSub: {
      color: "#cbd5e1",
      fontSize: 9,
    },
    heroLinks: {
      color: "#94a3b8",
      fontSize: 8.5,
      marginTop: 4,
    },
    name: {
      fontSize: isMinimal ? 20 : 22,
      fontFamily: "Helvetica-Bold",
      color: bodyText,
      marginBottom: 6,
    },
    contact: {
      fontSize: 9,
      color: muted,
      marginBottom: 4,
    },
    links: {
      fontSize: 8.5,
      color: primary,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 10.5,
      fontFamily: "Helvetica-Bold",
      color: primary,
      marginTop: isMinimal ? 8 : 10,
      marginBottom: 5,
      borderBottomWidth: isMinimal ? 0 : 0.8,
      borderBottomColor: "#e4e7ec",
      paddingBottom: isMinimal ? 0 : 2,
    },
    sectionTitleMinimal: {
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      color: "#344054",
      marginTop: 10,
      marginBottom: 4,
    },
    paragraph: {
      marginBottom: 6,
      textAlign: "left",
      lineHeight: 1.35,
    },
    roleTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 10,
      marginTop: 6,
    },
    roleMeta: {
      fontSize: 8.5,
      color: muted,
      marginBottom: 3,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 3,
      paddingLeft: 2,
    },
    bullet: {
      width: 10,
      fontSize: 9,
      color: muted,
    },
    bulletText: {
      flex: 1,
      fontSize: 9,
    },
    eduLine: {
      fontSize: 9.5,
      marginBottom: 4,
    },
    skillsLine: {
      fontSize: 9,
      color: bodyText,
      marginTop: 2,
    },
    projectHead: {
      fontFamily: "Helvetica-Bold",
      fontSize: 9.5,
      marginTop: 5,
    },
    projectSub: {
      fontSize: 8.5,
      color: muted,
      marginBottom: 2,
    },
    certLine: {
      fontSize: 9,
      marginBottom: 2,
    },
    bodyPad: {
      paddingHorizontal: 40,
    },
  });
}

export function ResumePdfDocument({ input, templateId }: ResumePdfDocumentProps) {
  const { resume, basicInfo, educationItems, selectedSkills } = input;
  const styles = createStyles(templateId);
  const name = basicInfo.name.trim() || resume.title || "Résumé";
  const contactLine = buildContactParts(basicInfo).join("  ·  ");
  const linkLine = buildLinkLine(basicInfo);
  const isModern = templateId === "modern";
  const isMinimal = templateId === "minimal";

  const sectionTitleStyle = isMinimal ? styles.sectionTitleMinimal : styles.sectionTitle;

  const experienceItems = resume.experienceItems ?? [];
  const eduUsable = educationItems.filter((e) => e.school.trim() || e.degree.trim());
  const projects = resume.projectItems ?? [];

  const summaryBlock =
    resume.summary?.trim() ?
      <View>
        <Text style={sectionTitleStyle}>Summary</Text>
        <Text style={styles.paragraph}>{resume.summary.trim()}</Text>
      </View>
    : null;

  const experienceBlock =
    experienceItems.length > 0 ?
      <View>
        <Text style={sectionTitleStyle}>Experience</Text>
        {experienceItems.map((item) => (
          <View key={item.id}>
            <Text style={styles.roleTitle}>
              {[item.title, item.company].filter(Boolean).join(" · ")}
            </Text>
            <Text style={styles.roleMeta}>
              {[item.dates, item.location].filter(Boolean).join(" · ")}
            </Text>
            {item.achievements
              .map((a) => a.trim())
              .filter(Boolean)
              .map((achievement, index) => (
                <View key={`${item.id}-b-${index}`} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{achievement}</Text>
                </View>
              ))}
          </View>
        ))}
      </View>
    : null;

  const educationBlock =
    eduUsable.length > 0 ?
      <View>
        <Text style={sectionTitleStyle}>Education</Text>
        {eduUsable.map((e) => (
          <Text key={e.id} style={styles.eduLine}>
            {[e.degree, e.school, e.dates].filter(Boolean).join(" · ")}
            {e.details.trim() ? `\n${e.details.trim()}` : ""}
          </Text>
        ))}
      </View>
    : null;

  const skillsBlock =
    selectedSkills.length > 0 ?
      <View>
        <Text style={sectionTitleStyle}>Skills</Text>
        <Text style={styles.skillsLine}>{selectedSkills.join(", ")}</Text>
      </View>
    : null;

  const projectsBlock =
    projects.length > 0 ?
      <View>
        <Text style={sectionTitleStyle}>Projects</Text>
        {projects.map((p) => (
          <View key={p.id}>
            <Text style={styles.projectHead}>{p.name || "Project"}</Text>
            {p.technologies.trim() ?
              <Text style={styles.projectSub}>{p.technologies.trim()}</Text>
            : null}
            {p.description.trim() ?
              <Text style={styles.paragraph}>{p.description.trim()}</Text>
            : null}
            {p.highlights
              .map((h) => h.trim())
              .filter(Boolean)
              .map((h, index) => (
                <View key={`${p.id}-h-${index}`} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{h}</Text>
                </View>
              ))}
          </View>
        ))}
      </View>
    : null;

  const certLines = (resume.certifications ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const certificationsBlock =
    certLines.length > 0 ?
      <View>
        <Text style={sectionTitleStyle}>Certifications</Text>
        {certLines.map((line, index) => (
          <Text key={`cert-${index}`} style={styles.certLine}>
            • {line}
          </Text>
        ))}
      </View>
    : null;

  const headerClassic = (
    <View>
      <Text style={styles.name}>{name}</Text>
      {contactLine ? <Text style={styles.contact}>{contactLine}</Text> : null}
      {linkLine ? <Text style={styles.links}>{linkLine}</Text> : null}
    </View>
  );

  const headerModern = (
    <View style={styles.hero}>
      <Text style={styles.heroName}>{name}</Text>
      {contactLine ? <Text style={styles.heroSub}>{contactLine}</Text> : null}
      {linkLine ? <Text style={styles.heroLinks}>{linkLine}</Text> : null}
    </View>
  );

  const inner = (
    <>
      {summaryBlock}
      {experienceBlock}
      {educationBlock}
      {skillsBlock}
      {projectsBlock}
      {certificationsBlock}
    </>
  );

  return (
    <Document title={name} author="Resume Tailor">
      <Page size="A4" style={styles.page} wrap>
        {isModern ? headerModern : headerClassic}
        {isModern ? <View style={styles.bodyPad}>{inner}</View> : inner}
      </Page>
    </Document>
  );
}
