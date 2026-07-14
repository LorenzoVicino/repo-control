export type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

export type ViewMode = "map" | "table";
export type ColorMode = "light" | "dark";
