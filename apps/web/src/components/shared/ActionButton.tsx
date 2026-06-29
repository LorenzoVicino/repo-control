import { Button, CircularProgress } from "@mui/material";
import React from "react";
import { runProjectAction } from "../../api/client";
import type { CommandResult } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";

type ActionButtonProps = {
  projectId: string;
  actionPath: string;
  label: string;
  icon: React.ReactNode;
  body?: unknown;
  disabled?: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted?: () => void;
};

export function ActionButton({
  projectId,
  actionPath,
  label,
  icon,
  body,
  disabled = false,
  onResult,
  onCompleted
}: ActionButtonProps) {
  const [isRunning, setIsRunning] = React.useState(false);

  async function runAction() {
    setIsRunning(true);

    try {
      const result = await runProjectAction(projectId, actionPath, label, body);
      onResult(result);
      onCompleted?.();
    } catch (error) {
      onResult(commandErrorResult(label, error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Button
      size="small"
      variant="contained"
      startIcon={isRunning ? <CircularProgress size={16} /> : icon}
      onClick={runAction}
      disabled={disabled || isRunning}
    >
      {label}
    </Button>
  );
}
