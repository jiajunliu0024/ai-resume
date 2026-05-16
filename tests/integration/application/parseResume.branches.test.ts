/**
 * `parseResume` orchestration with mocked PDF extraction + AI parsers.
 * Validates branch order: vision AI → plain-text AI → local `parseResumeSections`, plus hard failure when PDF text is empty.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiParsedResume } from "../../../src/infrastructure/ai/aiResumeParser";
import {
  extractTextFromPdf,
  renderPdfPagesToImageDataUrls,
} from "../../../src/infrastructure/parser/pdfResumeParser";
import {
  parseResumeWithAiProviderFromPdfPageImages,
  parseResumeWithAiProviderFromPlainText,
} from "../../../src/infrastructure/ai/aiResumeParser";
import { parseResume } from "../../../src/application/parseResume";

vi.mock("../../../src/infrastructure/parser/pdfResumeParser", () => ({
  extractTextFromPdf: vi.fn(),
  renderPdfPagesToImageDataUrls: vi.fn(),
}));

vi.mock("../../../src/infrastructure/ai/aiResumeParser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/infrastructure/ai/aiResumeParser")>();
  return {
    ...actual,
    parseResumeWithAiProviderFromPdfPageImages: vi.fn(),
    parseResumeWithAiProviderFromPlainText: vi.fn(),
  };
});

const pdfExtractText = vi.mocked(extractTextFromPdf);
const pdfRenderImages = vi.mocked(renderPdfPagesToImageDataUrls);
const aiVision = vi.mocked(parseResumeWithAiProviderFromPdfPageImages);
const aiPlain = vi.mocked(parseResumeWithAiProviderFromPlainText);

/** Minimal AI-shaped sections accepted by `buildResume`. */
function mockAiParsedResume(label: string): AiParsedResume {
  return {
    basicInfo: `${label}\nmeta@example.com`,
    basicInfoFields: {
      name: label,
      email: "meta@example.com",
      phone: "",
      location: "",
      links: [],
    },
    summary: `${label} summary`,
    skills: "Skills line",
    experience: "",
    experienceItems: [
      {
        id: "experience-vision",
        title: "Role",
        company: "Corp",
        dates: "",
        location: "",
        achievements: [`${label} win`],
      },
    ],
    projects: "",
    projectItems: [],
    education: "",
    educationItems: [],
    certifications: "",
  };
}

describe("parseResume branches (mocked PDF + AI)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("uses vision AI when provider supports rasterised pages and images rasterise", async () => {
    const sections = mockAiParsedResume("vision");
    pdfExtractText.mockResolvedValue("");
    pdfRenderImages.mockResolvedValue(["data:image/jpeg;base64,pretend"]);
    aiVision.mockResolvedValue(sections);
    aiPlain.mockRejectedValue(new Error("plain should not win"));

    const file = new File([new Uint8Array([1, 2, 3])], "cv.pdf", { type: "application/pdf" });
    const resume = await parseResume("My CV", file, { apiKey: "sk-test", aiProvider: "openai" });

    expect(aiVision).toHaveBeenCalledWith(
      ["data:image/jpeg;base64,pretend"],
      "sk-test",
      "openai",
    );
    expect(aiPlain).not.toHaveBeenCalled();
    expect(resume.parseSource).toBe("ai");
    expect(resume.parseStatus).toBe("parsed");
    expect(resume.basicInfoFields?.name).toBe("vision");
    expect(resume.summary).toBe("vision summary");
  });

  it("uses plain-text AI when vision is unavailable and PDF text extracts", async () => {
    const sections = mockAiParsedResume("plainpath");
    pdfExtractText.mockResolvedValue("  Resume plain body for ai.  ");
    pdfRenderImages.mockResolvedValue([]);
    aiVision.mockRejectedValue(new Error("vision unavailable"));
    aiPlain.mockResolvedValue(sections);

    const file = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
    const resume = await parseResume("T", file, { apiKey: "k", aiProvider: "deepseek" });

    expect(pdfRenderImages).not.toHaveBeenCalled();
    expect(aiVision).not.toHaveBeenCalled();
    expect(aiPlain).toHaveBeenCalledWith("Resume plain body for ai.", "k", "deepseek");
    expect(resume.parseSource).toBe("ai");
    expect(resume.basicInfoFields?.name).toBe("plainpath");
  });

  it("falls back to local parseResumeSections after vision and plain-text AI both fail", async () => {
    pdfExtractText.mockResolvedValue(["Pat Lee", "pat.lee@fixture.test", "", "skills", "Go"].join("\n"));
    pdfRenderImages.mockResolvedValue(["data:image/jpeg;base64,x"]);
    aiVision.mockRejectedValue(new Error("vision down"));
    aiPlain.mockRejectedValue(new Error("chat down"));

    const file = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
    const resume = await parseResume("T", file, { apiKey: "k", aiProvider: "openai" });

    expect(aiVision).toHaveBeenCalled();
    expect(aiPlain).toHaveBeenCalled();
    expect(resume.parseSource).toBe("local");
    expect(resume.parseStatus).toBe("fallback");
    expect(resume.basicInfoFields?.email).toBe("pat.lee@fixture.test");
  });

  it("throws when extracted PDF text is empty and AI paths do not populate data", async () => {
    pdfExtractText.mockResolvedValue("   ");
    pdfRenderImages.mockResolvedValue([]);
    aiPlain.mockRejectedValue(new Error("no"));

    const file = new File([new Uint8Array([1])], "empty.pdf", { type: "application/pdf" });

    await expect(parseResume("T", file, { apiKey: "secret", aiProvider: "deepseek" })).rejects.toThrow(
      /Could not read text from this PDF/,
    );
  });

  it("skips vision when raster returns no images then succeeds via plain-text AI (openai)", async () => {
    const sections = mockAiParsedResume("raster-skipped");
    pdfExtractText.mockResolvedValue("Visible resume text chunk.");
    pdfRenderImages.mockResolvedValue([]);
    aiPlain.mockResolvedValue(sections);

    const file = new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" });
    const resume = await parseResume("T", file, { apiKey: "k", aiProvider: "openai" });

    expect(aiVision).not.toHaveBeenCalled();
    expect(aiPlain).toHaveBeenCalledOnce();
    expect(resume.parseSource).toBe("ai");
    expect(resume.summary).toBe("raster-skipped summary");
  });
});
