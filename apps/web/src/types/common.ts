export type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

export type ProjectOperationSource = "overview" | "changes" | "branches" | "docker" | "terminal";

export type ViewMode = "map" | "table";
export type ColorMode = "light" | "dark";
export type ColorPalette = "white" | "black" | "red" | "blue" | "green";
