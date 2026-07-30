export function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

// Unlike getString, an explicit empty string is preserved rather than replaced by the
// fallback — needed for fields (e.g. a pending run's completedAt) where "" is a
// meaningful, distinct value from "missing".
export function getStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
