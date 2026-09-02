// Relative phrasing for anything under a month, an exact date beyond it; `null` for a value
// that is not a date, so the caller chooses its own wording for "unknown".
export function formatRelativeTime(value: string | null | undefined, language: string, now = Date.now()): string | null {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return null;

  const relativeFormatter = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const elapsedMinutes = Math.round((timestamp - now) / (60 * 1000));
  if (Math.abs(elapsedMinutes) < 1) return relativeFormatter.format(0, "second");
  if (Math.abs(elapsedMinutes) < 60) return relativeFormatter.format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return relativeFormatter.format(elapsedHours, "hour");
  const elapsedDays = Math.round(elapsedHours / 24);
  if (Math.abs(elapsedDays) < 30) return relativeFormatter.format(elapsedDays, "day");

  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(timestamp);
}

// Compact durations for lists: "850 ms", "12 s", "3 min 20 s", "1 h 05 min".
export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}
