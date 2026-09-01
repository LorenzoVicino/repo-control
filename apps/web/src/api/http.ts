type ApiErrorPayload = {
  message?: unknown;
  error?: unknown;
  code?: unknown;
};

// Carries the status and error code alongside the message so a caller can react to the
// kind of failure - a lapsed session, a locked sign-in - instead of matching on prose that
// the server returns in one language and the interface renders in another.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly payload: unknown;

  constructor(message: string, status: number, code: string | null, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function requestJson<T>(
  path: string,
  fallbackMessage: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, init);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      getApiErrorMessage(payload, fallbackMessage),
      response.status,
      getApiErrorCode(payload),
      payload
    );
  }

  return payload as T;
}

export function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

// A request the server refused because the session is missing or has lapsed. Any feature
// can hit this at any time, so the application shell watches for it and returns to the
// sign-in screen rather than leaving a page of failed panels behind.
export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === "UNAUTHENTICATED";
}

function getApiErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (!isRecord(payload)) {
    return fallbackMessage;
  }

  const errorPayload = payload as ApiErrorPayload;
  if (typeof errorPayload.message === "string") return errorPayload.message;
  if (typeof errorPayload.error === "string") return errorPayload.error;
  return fallbackMessage;
}

function getApiErrorCode(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const code = (payload as ApiErrorPayload).code;
  return typeof code === "string" ? code : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
