/** Shown in UI when the provider rejects the key (401) or rate-limits (429). */
export const AI_API_NOT_VALID_MESSAGE = "This API is not valid.";

export function isInvalidApiKeyOrRateLimitStatus(status: number): boolean {
  return status === 401 || status === 429;
}

export function isAiApiNotValidError(error: unknown): boolean {
  return error instanceof Error && error.message === AI_API_NOT_VALID_MESSAGE;
}

function parseProviderErrorDetail(responseBody: string): string {
  const trimmed = responseBody.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const json = JSON.parse(trimmed) as {
      error?: { message?: string };
      message?: string;
    };
    const nested = json.error?.message;
    if (typeof nested === "string" && nested.trim()) {
      return nested.trim();
    }
    if (typeof json.message === "string" && json.message.trim()) {
      return json.message.trim();
    }
    return trimmed;
  } catch {
    return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
  }
}

export function formatAiProviderErrorMessage(
  status: number,
  responseBody: string,
  providerDisplayName: string,
): string {
  if (isInvalidApiKeyOrRateLimitStatus(status)) {
    return AI_API_NOT_VALID_MESSAGE;
  }

  const detail = parseProviderErrorDetail(responseBody);
  if (detail) {
    return `${providerDisplayName} request failed (${status}): ${detail}`;
  }

  return `${providerDisplayName} request failed (${status}).`;
}

export async function throwIfAiProviderResponseNotOk(
  response: Response,
  providerDisplayName: string,
): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new Error(formatAiProviderErrorMessage(response.status, body, providerDisplayName));
}
