import TerminalIcon from "@mui/icons-material/Terminal";
import { Button, CircularProgress, InputAdornment, Stack, TextField } from "@mui/material";
import React from "react";
import { runTerminalCommand } from "../../api/client";
import type { CommandResult } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";

type TerminalPanelProps = {
  projectId: string;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function TerminalPanel({ projectId, onResult, onCompleted }: TerminalPanelProps) {
  const [command, setCommand] = React.useState("git status --short --branch");
  const [isRunning, setIsRunning] = React.useState(false);

  async function runCommand() {
    const nextCommand = command.trim();

    if (!nextCommand || isRunning) {
      return;
    }

    setIsRunning(true);

    try {
      const result = await runTerminalCommand(projectId, nextCommand);
      onResult(result);
      onCompleted();
    } catch (error) {
      onResult(commandErrorResult(nextCommand, error));
    } finally {
      setIsRunning(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runCommand();
    }
  }

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <TextField
        size="small"
        label="Comando"
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        onKeyDown={handleKeyDown}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <TerminalIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />
      <Button
        variant="contained"
        startIcon={isRunning ? <CircularProgress color="inherit" size={16} /> : <TerminalIcon />}
        onClick={runCommand}
        disabled={isRunning || command.trim().length === 0}
        sx={{ minWidth: 112 }}
      >
        Esegui
      </Button>
    </Stack>
  );
}
