import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { ResumePdfDocument } from "./ResumePdfDocument";
import type { GenerateResumePdfInput, ResumePdfTemplateId } from "./resumePdfTypes";

export type { GenerateResumePdfInput, ResumePdfTemplateId } from "./resumePdfTypes";
export {
  isResumePdfTemplateId,
  RESUME_PDF_TEMPLATES,
  RESUME_PDF_TEMPLATE_IDS,
} from "./resumePdfTypes";

export async function generateResumePdfBlob(
  input: GenerateResumePdfInput,
  templateId: ResumePdfTemplateId,
): Promise<Blob> {
  const documentElement = createElement(ResumePdfDocument, { input, templateId });
  // `ResumePdfDocument` renders `<Document>` as root; `pdf()` typings only accept `Document` elements.
  return pdf(documentElement as Parameters<typeof pdf>[0]).toBlob();
}
