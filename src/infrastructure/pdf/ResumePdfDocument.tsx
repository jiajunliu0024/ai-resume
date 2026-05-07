import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { GenerateResumePdfInput, ResumePdfTemplateId } from "./resumePdfTypes";

type ResumePdfDocumentProps = {
  input: GenerateResumePdfInput;
  templateId: ResumePdfTemplateId;
};

/** Aligns with LaTeX `\\setstretch{1.12}` — same line gap within every body paragraph. */
const PDF_BODY_LINE_HEIGHT = 1.12;

const NAVY = "#073391";
const BODY_COLOR = "#101828";
const MUTED = "#667085";

type PdfTheme = {
  headerVariant: "classic" | "modern";
  sectionVariant: "accent" | "minimal" | "plainRule" | "navy";
  fontRegular: string;
  fontBold: string;
  baseFontSize: number;
  pagePaddingTop: number;
  pagePaddingH: number;
  primary: string;
};

function resolvePdfTheme(templateId: ResumePdfTemplateId): PdfTheme {
  switch (templateId) {
    case "minimal-clean":
      return {
        headerVariant: "classic",
        sectionVariant: "minimal",
        fontRegular: "Helvetica",
        fontBold: "Helvetica-Bold",
        baseFontSize: 9.5,
        pagePaddingTop: 36,
        pagePaddingH: 40,
        primary: "#475467",
      };
    case "plain-sections":
      return {
        headerVariant: "classic",
        sectionVariant: "plainRule",
        fontRegular: "Helvetica",
        fontBold: "Helvetica-Bold",
        baseFontSize: 9.5,
        pagePaddingTop: 36,
        pagePaddingH: 40,
        primary: NAVY,
      };
    case "serif-formal":
      return {
        headerVariant: "classic",
        sectionVariant: "accent",
        fontRegular: "Times-Roman",
        fontBold: "Times-Bold",
        baseFontSize: 9.5,
        pagePaddingTop: 36,
        pagePaddingH: 40,
        primary: NAVY,
      };
    case "sans-modern":
      return {
        headerVariant: "modern",
        sectionVariant: "accent",
        fontRegular: "Helvetica",
        fontBold: "Helvetica-Bold",
        baseFontSize: 9.5,
        pagePaddingTop: 0,
        pagePaddingH: 0,
        primary: NAVY,
      };
    case "compact-10pt":
      return {
        headerVariant: "classic",
        sectionVariant: "minimal",
        fontRegular: "Helvetica",
        fontBold: "Helvetica-Bold",
        baseFontSize: 8.5,
        pagePaddingTop: 28,
        pagePaddingH: 32,
        primary: "#475467",
      };
    case "ruled-navy":
      return {
        headerVariant: "classic",
        sectionVariant: "navy",
        fontRegular: "Helvetica",
        fontBold: "Helvetica-Bold",
        baseFontSize: 9.5,
        pagePaddingTop: 36,
        pagePaddingH: 40,
        primary: NAVY,
      };
    case "classic-sample":
    default:
      return {
        headerVariant: "classic",
        sectionVariant: "accent",
        fontRegular: "Helvetica",
        fontBold: "Helvetica-Bold",
        baseFontSize: 9.5,
        pagePaddingTop: 36,
        pagePaddingH: 40,
        primary: NAVY,
      };
  }
}

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

function splitSummaryParagraphs(summary: string): string[] {
  return summary
    .trim()
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\n+/g, " ").trim())
    .filter(Boolean);
}

function createStyles(templateId: ResumePdfTemplateId) {
  const theme = resolvePdfTheme(templateId);
  const fs = theme.baseFontSize;
  const fsSmall = fs - 0.5;
  const fsTiny = fs - 1;
  const bodyLine = { lineHeight: PDF_BODY_LINE_HEIGHT };

  const sectionTitleBase = {
    fontSize: fs + 1,
    fontFamily: theme.fontBold,
    marginTop: theme.sectionVariant === "minimal" ? 8 : 10,
    marginBottom: 5,
    paddingBottom: 2,
    ...bodyLine,
  };

  let sectionTitleAccent: Record<string, unknown> = {
    ...sectionTitleBase,
    color: theme.primary,
    borderBottomWidth: 0.8,
    borderBottomColor: "#e4e7ec",
  };

  if (theme.sectionVariant === "minimal") {
    sectionTitleAccent = {
      ...sectionTitleBase,
      fontSize: fs + 0.5,
      color: "#344054",
      borderBottomWidth: 0,
      paddingBottom: 0,
    };
  } else if (theme.sectionVariant === "plainRule") {
    sectionTitleAccent = {
      ...sectionTitleBase,
      color: BODY_COLOR,
      borderBottomWidth: 1.2,
      borderBottomColor: theme.primary,
    };
  } else if (theme.sectionVariant === "navy") {
    sectionTitleAccent = {
      ...sectionTitleBase,
      color: theme.primary,
      borderBottomWidth: 1,
      borderBottomColor: theme.primary,
    };
  }

  return StyleSheet.create({
    page: {
      fontFamily: theme.fontRegular,
      fontSize: fs,
      color: BODY_COLOR,
      lineHeight: PDF_BODY_LINE_HEIGHT,
      paddingTop: theme.pagePaddingTop,
      paddingBottom: 40,
      paddingHorizontal: theme.pagePaddingH,
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
      lineHeight: 1.15,
    },
    heroSub: {
      color: "#cbd5e1",
      fontSize: fsTiny,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    heroLinks: {
      color: "#94a3b8",
      fontSize: fsTiny,
      marginTop: 4,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    name: {
      fontSize: theme.sectionVariant === "minimal" ? fs + 10.5 : fs + 12.5,
      fontFamily: theme.fontBold,
      color: BODY_COLOR,
      marginBottom: 6,
      lineHeight: 1.12,
    },
    contact: {
      fontSize: fsSmall,
      color: MUTED,
      marginBottom: 4,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    links: {
      fontSize: fsTiny,
      color: theme.primary,
      marginBottom: 12,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    sectionTitle: sectionTitleAccent as {
      fontSize: number;
      fontFamily: string;
      color?: string;
      marginTop: number;
      marginBottom: number;
      borderBottomWidth?: number;
      borderBottomColor?: string;
      paddingBottom: number;
      lineHeight: number;
    },
    paragraph: {
      marginBottom: 6,
      textAlign: "left",
      lineHeight: PDF_BODY_LINE_HEIGHT,
      fontSize: fs,
      fontFamily: theme.fontRegular,
    },
    roleTitle: {
      fontFamily: theme.fontBold,
      fontSize: fs + 0.5,
      marginTop: 6,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    roleMeta: {
      fontSize: fsSmall,
      color: MUTED,
      marginBottom: 3,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 3,
      paddingLeft: 2,
    },
    bullet: {
      width: 10,
      fontSize: fs,
      color: MUTED,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    bulletText: {
      flex: 1,
      fontSize: fs,
      fontFamily: theme.fontRegular,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    eduLine: {
      fontSize: fs,
      marginBottom: 4,
      lineHeight: PDF_BODY_LINE_HEIGHT,
      fontFamily: theme.fontRegular,
    },
    skillsLine: {
      fontSize: fs,
      color: BODY_COLOR,
      marginTop: 2,
      lineHeight: PDF_BODY_LINE_HEIGHT,
      fontFamily: theme.fontRegular,
    },
    projectHead: {
      fontFamily: theme.fontBold,
      fontSize: fs,
      marginTop: 5,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    projectSub: {
      fontSize: fsSmall,
      color: MUTED,
      marginBottom: 2,
      lineHeight: PDF_BODY_LINE_HEIGHT,
    },
    certLine: {
      fontSize: fs,
      marginBottom: 2,
      lineHeight: PDF_BODY_LINE_HEIGHT,
      fontFamily: theme.fontRegular,
    },
    bodyPad: {
      paddingHorizontal: 40,
    },
  });
}

export function ResumePdfDocument({ input, templateId }: ResumePdfDocumentProps) {
  const { resume, basicInfo, educationItems, selectedSkills } = input;
  const styles = createStyles(templateId);
  const theme = resolvePdfTheme(templateId);
  const name = basicInfo.name.trim() || resume.title || "Résumé";
  const contactLine = buildContactParts(basicInfo).join("  ·  ");
  const linkLine = buildLinkLine(basicInfo);
  const isModern = theme.headerVariant === "modern";

  const experienceItems = resume.experienceItems ?? [];
  const eduUsable = educationItems.filter((e) => e.school.trim() || e.degree.trim());
  const projects = resume.projectItems ?? [];

  const summaryChunks = resume.summary?.trim() ? splitSummaryParagraphs(resume.summary) : [];

  const summaryBlock =
    summaryChunks.length > 0 ?
      <View>
        <Text style={styles.sectionTitle}>Summary</Text>
        {summaryChunks.map((chunk, index) => (
          <Text key={`sum-${index}`} style={styles.paragraph}>
            {chunk}
          </Text>
        ))}
      </View>
    : null;

  const experienceBlock =
    experienceItems.length > 0 ?
      <View>
        <Text style={styles.sectionTitle}>Experience</Text>
        {experienceItems.map((item) => (
          <View key={item.id}>
            <Text style={styles.roleTitle}>{[item.title, item.company].filter(Boolean).join(" · ")}</Text>
            <Text style={styles.roleMeta}>{[item.dates, item.location].filter(Boolean).join(" · ")}</Text>
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
        <Text style={styles.sectionTitle}>Education</Text>
        {eduUsable.map((e) => (
          <View key={e.id}>
            <Text style={styles.eduLine}>
              {[e.degree, e.school, e.dates].filter(Boolean).join(" · ")}
            </Text>
            {e.details.trim() ?
              <Text style={styles.paragraph}>{e.details.trim()}</Text>
            : null}
          </View>
        ))}
      </View>
    : null;

  const skillsBlock =
    selectedSkills.length > 0 ?
      <View>
        <Text style={styles.sectionTitle}>Skills</Text>
        <Text style={styles.skillsLine}>{selectedSkills.join(", ")}</Text>
      </View>
    : null;

  const projectsBlock =
    projects.length > 0 ?
      <View>
        <Text style={styles.sectionTitle}>Projects</Text>
        {projects.map((p) => (
          <View key={p.id}>
            <Text style={styles.projectHead}>{p.name || "Project"}</Text>
            {p.technologies.trim() ? <Text style={styles.projectSub}>{p.technologies.trim()}</Text> : null}
            {p.description.trim() ? <Text style={styles.paragraph}>{p.description.trim()}</Text> : null}
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
        <Text style={styles.sectionTitle}>Certifications</Text>
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
