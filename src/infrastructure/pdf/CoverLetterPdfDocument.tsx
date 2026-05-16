import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type CoverLetterPdfDocumentProps = {
  jobTitle: string;
  company: string;
  body: string;
};

const NAVY = "#073391";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "#101828",
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 52,
  },
  meta: {
    fontSize: 9,
    color: "#667085",
    marginBottom: 28,
    lineHeight: 1.4,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: "justify",
  },
});

/** Single-page-first cover letter PDF; overflows to additional pages if needed. */
export function CoverLetterPdfDocument({ jobTitle, company, body }: CoverLetterPdfDocumentProps) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View wrap={false}>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>
            Cover letter
          </Text>
          <Text style={styles.meta}>
            Role: {jobTitle}
            {"\n"}
            Company: {company}
          </Text>
        </View>
        {paragraphs.length ? (
          paragraphs.map((text, index) => (
            <Text key={`p-${index}`} style={styles.paragraph}>
              {text.replace(/\s+/g, " ").trim()}
            </Text>
          ))
        ) : (
          <Text style={styles.paragraph}>{body.trim()}</Text>
        )}
      </Page>
    </Document>
  );
}
