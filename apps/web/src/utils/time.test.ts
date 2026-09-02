import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./time";

const now = Date.parse("2026-09-02T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it("phrases recent moments relatively and older ones as a date", () => {
    expect(formatRelativeTime("2026-09-02T11:59:50.000Z", "en", now)).toBe("now");
    expect(formatRelativeTime("2026-09-02T11:45:00.000Z", "en", now)).toBe("15 minutes ago");
    expect(formatRelativeTime("2026-09-02T09:00:00.000Z", "en", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-09-01T12:00:00.000Z", "en", now)).toBe("yesterday");
    expect(formatRelativeTime("2026-08-20T12:00:00.000Z", "en", now)).toBe("13 days ago");
    expect(formatRelativeTime("2026-06-01T12:00:00.000Z", "en", now)).toBe("Jun 1, 2026");
  });

  it("returns null for anything that is not a date", () => {
    expect(formatRelativeTime(null, "en", now)).toBeNull();
    expect(formatRelativeTime("not a date", "en", now)).toBeNull();
  });
});

describe("formatDurationMs", () => {
  it("picks the unit from the size of the duration", async () => {
    const { formatDurationMs } = await import("./time");
    expect(formatDurationMs(850)).toBe("850 ms");
    expect(formatDurationMs(12_400)).toBe("12 s");
    expect(formatDurationMs(200_000)).toBe("3 min 20 s");
    expect(formatDurationMs(120_000)).toBe("2 min");
    expect(formatDurationMs(3_900_000)).toBe("1 h 05 min");
    expect(formatDurationMs(-1)).toBe("");
  });
});
