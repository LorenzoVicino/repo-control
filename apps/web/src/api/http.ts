type ApiErrorPayload = {
  message?: unknown;
  error?: unknown;
};

export async function requestJson<T>(
  path: string,
  fallbackMessage: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, init);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, fallbackMessage));
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

function getApiErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (!isRecord(payload)) {
    return fallbackMessage;
  }

  const errorPayload = payload as ApiErrorPayload;
  if (typeof errorPayload.message === "string") return errorPayload.message;
  if (typeof errorPayload.error === "string") return errorPayload.error;
  return fallbackMessage;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
