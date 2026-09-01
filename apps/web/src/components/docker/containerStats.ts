import type { DockerContainerStats } from "../../types/docker";

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

// Decimal units, matching what `docker stats` prints for I/O, so a value shown here can be
// compared with the same number read from a terminal.
export function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  let amount = Math.max(0, value);
  let unitIndex = 0;

  while (amount >= 1000 && unitIndex < BYTE_UNITS.length - 1) {
    amount /= 1000;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 || amount >= 100 ? 0 : 1;

  return `${amount.toFixed(decimals)} ${BYTE_UNITS[unitIndex]}`;
}

export function formatPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

export function findContainerStats(
  stats: DockerContainerStats[] | undefined,
  containerId: string
): DockerContainerStats | null {
  if (!stats) {
    return null;
  }

  const requestedId = containerId.toLowerCase();

  return (
    stats.find((entry) => {
      const knownId = entry.id.toLowerCase();
      // `docker stats` and `docker ps` can report IDs of different lengths for the same
      // container, so neither side can rely on an exact match.
      return knownId === requestedId || knownId.startsWith(requestedId) || requestedId.startsWith(knownId);
    }) ?? null
  );
}
