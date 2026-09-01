import { describe, expect, it } from "vitest";
import type { DockerContainerStats } from "../../types/docker";
import { findContainerStats, formatBytes, formatPercent } from "./containerStats";

function stats(id: string): DockerContainerStats {
  return {
    id,
    name: id,
    cpuPercent: 1,
    memoryUsedBytes: 1,
    memoryLimitBytes: 1,
    memoryPercent: 1,
    networkInBytes: 1,
    networkOutBytes: 1,
    blockReadBytes: 1,
    blockWriteBytes: 1,
    processCount: 1
  };
}

describe("container stats formatting", () => {
  it("scales byte values the way docker stats prints them", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(640)).toBe("640 B");
    expect(formatBytes(1_200)).toBe("1.2 kB");
    expect(formatBytes(134_217_728)).toBe("134 MB");
    expect(formatBytes(2_040_109_466)).toBe("2.0 GB");
    expect(formatBytes(9_500_000_000_000)).toBe("9.5 TB");
    // Beyond the largest unit the number keeps growing rather than wrapping to a wrong one.
    expect(formatBytes(2_500_000_000_000_000)).toBe("2500 TB");
  });

  it("leaves a missing measurement visibly missing", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-10)).toBe("0 B");
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatPercent(12.53)).toBe("12.5%");
  });

  it("matches a container whose ID is reported at a different length", () => {
    const samples = [stats("a1b2c3d4e5f6"), stats("ffffffffffff")];

    expect(findContainerStats(samples, "a1b2c3d4e5f6")?.id).toBe("a1b2c3d4e5f6");
    expect(findContainerStats(samples, "A1B2C3D4E5F6")?.id).toBe("a1b2c3d4e5f6");
    expect(findContainerStats(samples, "a1b2c3d4e5f6aaaaaaaaaaaa")?.id).toBe("a1b2c3d4e5f6");
    expect(findContainerStats([stats("a1b2c3d4e5f6aaaa")], "a1b2c3d4e5f6")?.id).toBe("a1b2c3d4e5f6aaaa");
    expect(findContainerStats(samples, "0123456789ab")).toBe(null);
    expect(findContainerStats(undefined, "a1b2c3d4e5f6")).toBe(null);
  });
});
