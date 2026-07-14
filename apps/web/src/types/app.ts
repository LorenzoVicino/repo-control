import type { CommandResult } from "./common";

export type AppUpdateResult = CommandResult & {
  restartScheduled: boolean;
};

export type AppUpdateStatus = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  error: string | null;
};
