// Helpers shared by several pages. Page-specific logic belongs in the page itself.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const generateUuid = (): string => crypto.randomUUID();

// Accepts UUIDs with surrounding whitespace or braces and returns the lowercase canonical form.
export const normalizeUuid = (rawValue: string): string => {
  const trimmed = rawValue.trim().replace(/[{}]/g, "");

  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error("This scan does not contain a valid UUID string.");
  }

  return trimmed.toLowerCase();
};

export const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const toSafeFileName = (value: string, fallback: string): string =>
  value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_") || fallback;
