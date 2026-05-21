import { describe, expect, it } from "vitest";
import {
  AI_API_NOT_VALID_MESSAGE,
  formatAiProviderErrorMessage,
  isAiApiNotValidError,
} from "../../../src/infrastructure/ai/aiProviderHttpError";

describe("aiProviderHttpError", () => {
  it("maps 401 and 429 to the invalid API message", () => {
    expect(formatAiProviderErrorMessage(401, "", "OpenAI")).toBe(AI_API_NOT_VALID_MESSAGE);
    expect(formatAiProviderErrorMessage(429, '{"error":{"message":"rate limit"}}', "OpenAI")).toBe(
      AI_API_NOT_VALID_MESSAGE,
    );
  });

  it("surfaces nested provider error messages for other status codes", () => {
    const body = JSON.stringify({ error: { message: "model not found" } });
    expect(formatAiProviderErrorMessage(404, body, "OpenAI")).toBe(
      "OpenAI request failed (404): model not found",
    );
  });

  it("detects invalid API errors for rethrow in parseResume", () => {
    expect(isAiApiNotValidError(new Error(AI_API_NOT_VALID_MESSAGE))).toBe(true);
    expect(isAiApiNotValidError(new Error("other"))).toBe(false);
  });
});
