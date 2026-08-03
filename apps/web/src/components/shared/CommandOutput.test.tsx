import { CssBaseline, ThemeProvider } from "@mui/material";
import { screen, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAppTheme } from "../../theme";
import type { CommandResult } from "../../types/common";
import { CommandOutput } from "./CommandOutput";

function result(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    ok: true,
    command: "git status",
    exitCode: 0,
    stdout: "clean",
    stderr: "",
    output: "clean",
    durationMs: 8,
    ...overrides
  };
}

function renderOutput(value: CommandResult, palette: "white" | "black" = "white") {
  return render(
    <ThemeProvider theme={createAppTheme(palette)}>
      <CssBaseline />
      <CommandOutput result={value} />
    </ThemeProvider>
  );
}

describe("CommandOutput", () => {
  it("shows a successful command with output and an exit code", () => {
    renderOutput(result());
    expect(screen.getByText("git status")).toBeVisible();
    expect(screen.getByText("exit 0 - 8ms")).toBeVisible();
    expect(screen.getByText("clean")).toBeVisible();
    expect(screen.getByTestId("CheckCircleIcon")).toBeVisible();
  });

  it("shows an empty failed command in a dark theme", () => {
    renderOutput(
      result({ ok: false, command: "git pull", exitCode: null, output: "", stderr: "failed", durationMs: 21 }),
      "black"
    );
    expect(screen.getByText("exit n/a - 21ms")).toBeVisible();
    expect(screen.getByText("Done")).toBeVisible();
    expect(screen.getByTestId("WarningAmberIcon")).toBeVisible();
  });
});
