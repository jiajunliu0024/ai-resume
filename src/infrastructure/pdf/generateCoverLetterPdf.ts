import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import {
  CoverLetterPdfDocument,
  type CoverLetterPdfDocumentProps,
} from "./CoverLetterPdfDocument";

export async function generateCoverLetterPdfBlob(
  props: CoverLetterPdfDocumentProps,
): Promise<Blob> {
  const documentElement = createElement(CoverLetterPdfDocument, props);
  return pdf(documentElement as Parameters<typeof pdf>[0]).toBlob();
}
