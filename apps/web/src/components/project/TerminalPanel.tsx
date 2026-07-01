import ClearAllIcon from "@mui/icons-material/ClearAll";
import SendIcon from "@mui/icons-material/Send";
import TerminalIcon from "@mui/icons-material/Terminal";
import {
  alpha,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from "@mui/material";
import React from "react";
import { runTerminalCommand } from "../../api/client";
import type { CommandResult } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";

type TerminalPanelProps = {
  projectId: string;
  projectName: string;
  projectPath: string;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

type TerminalEntry = {
  id: string;
  command: string;
  result: CommandResult | null;
};

const terminalFontFamily =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";

export function TerminalPanel({ projectId, projectName, projectPath, onResult, onCompleted }: TerminalPanelProps) {
  const theme = useTheme();
  const [command, setCommand] = React.useState("");
  const [entries, setEntries] = React.useState<TerminalEntry[]>([]);
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = React.useState<number | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const outputRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const shouldRestoreInputFocusRef = React.useRef(false);
  const promptPath = getPromptPath(projectPath);

  React.useEffect(() => {
    const outputElement = outputRef.current;

    if (!outputElement) {
      return;
    }

    outputElement.scrollTop = outputElement.scrollHeight;
  }, [entries, isRunning]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [projectId]);

  React.useEffect(() => {
    if (!isRunning && shouldRestoreInputFocusRef.current) {
      shouldRestoreInputFocusRef.current = false;
      inputRef.current?.focus();
    }
  }, [isRunning]);

  async function runCommand() {
    const nextCommand = command.trim();

    if (!nextCommand || isRunning) {
      return;
    }

    setIsRunning(true);
    setCommand("");
    setHistoryCursor(null);
    setHistory((currentHistory) => appendHistory(currentHistory, nextCommand));

    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEntries((currentEntries) => [...currentEntries, { id: entryId, command: nextCommand, result: null }]);

    try {
      const result = await runTerminalCommand(projectId, nextCommand);
      setEntries((currentEntries) =>
        currentEntries.map((entry) => (entry.id === entryId ? { ...entry, result } : entry))
      );
      onResult(result);
      onCompleted();
    } catch (error) {
      const result = commandErrorResult(nextCommand, error);
      setEntries((currentEntries) =>
        currentEntries.map((entry) => (entry.id === entryId ? { ...entry, result } : entry))
      );
      onResult(result);
    } finally {
      shouldRestoreInputFocusRef.current = true;
      setIsRunning(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runCommand();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setEntries([]);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHistoryCursor((currentCursor) => {
        if (history.length === 0) {
          return null;
        }

        const nextCursor = currentCursor === null ? history.length - 1 : Math.max(0, currentCursor - 1);
        setCommand(history[nextCursor]);
        return nextCursor;
      });
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHistoryCursor((currentCursor) => {
        if (currentCursor === null) {
          return null;
        }

        const nextCursor = currentCursor + 1;

        if (nextCursor >= history.length) {
          setCommand("");
          return null;
        }

        setCommand(history[nextCursor]);
        return nextCursor;
      });
    }
  }

  return (
    <Paper
      variant="outlined"
      onClick={() => inputRef.current?.focus()}
      sx={{
        height: { xs: 360, md: 520 },
        overflow: "hidden",
        bgcolor: theme.palette.mode === "light" ? "#07111f" : "#030712",
        borderColor: alpha(theme.palette.primary.main, 0.28),
        color: "#dbeafe",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto"
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.25,
          py: 0.85,
          borderBottom: "1px solid",
          borderColor: "rgba(148, 163, 184, 0.18)",
          bgcolor: "rgba(15, 23, 42, 0.92)"
        }}
      >
        <Stack direction="row" spacing={0.65} aria-hidden="true">
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ef4444" }} />
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#f59e0b" }} />
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#22c55e" }} />
        </Stack>

        <TerminalIcon sx={{ fontSize: 17, color: "#67e8f9", ml: 0.5 }} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="caption" noWrap sx={{ display: "block", fontFamily: terminalFontFamily, color: "#e2e8f0" }}>
            {projectName}
          </Typography>
          <Typography variant="caption" noWrap sx={{ display: "block", fontFamily: terminalFontFamily, color: "#94a3b8" }}>
            {projectPath}
          </Typography>
        </Box>

        <Chip
          size="small"
          label={isRunning ? "running" : "ready"}
          color={isRunning ? "warning" : "success"}
          variant="outlined"
          sx={{
            height: 22,
            fontFamily: terminalFontFamily,
            color: isRunning ? "#fde68a" : "#86efac",
            borderColor: isRunning ? "rgba(253, 230, 138, 0.38)" : "rgba(134, 239, 172, 0.38)"
          }}
        />
        <Tooltip title="Clear terminal">
          <span>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setEntries([]);
              }}
              disabled={entries.length === 0}
              sx={{ color: "#94a3b8" }}
            >
              <ClearAllIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Box
        ref={outputRef}
        sx={{
          minHeight: 0,
          overflow: "auto",
          px: 1.5,
          py: 1.25,
          fontFamily: terminalFontFamily,
          fontSize: 12.5,
          lineHeight: 1.55,
          scrollbarWidth: "thin"
        }}
      >
        {entries.length === 0 ? <TerminalWelcome projectName={projectName} projectPath={projectPath} /> : null}
        {entries.map((entry) => (
          <TerminalEntryBlock key={entry.id} entry={entry} />
        ))}
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{
          px: 1.5,
          py: 1,
          borderTop: "1px solid",
          borderColor: "rgba(148, 163, 184, 0.18)",
          bgcolor: "rgba(2, 6, 23, 0.92)",
          fontFamily: terminalFontFamily
        }}
      >
        <Prompt projectName={projectName} promptPath={promptPath} />
        <InputBase
          inputRef={inputRef}
          value={command}
          onChange={(event) => {
            setCommand(event.target.value);
            setHistoryCursor(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder="type a command"
          fullWidth
          sx={{
            color: "#e5e7eb",
            fontFamily: terminalFontFamily,
            fontSize: 13,
            "& input": {
              p: 0
            },
            "& input::placeholder": {
              color: "#64748b",
              opacity: 1
            }
          }}
        />
        <Tooltip title="Run command">
          <span>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                void runCommand();
              }}
              disabled={isRunning || command.trim().length === 0}
              sx={{
                color: "#67e8f9",
                border: "1px solid rgba(103, 232, 249, 0.25)",
                borderRadius: 1
              }}
            >
              {isRunning ? <CircularProgress color="inherit" size={16} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

function TerminalWelcome({ projectName, projectPath }: { projectName: string; projectPath: string }) {
  return (
    <Box sx={{ color: "#94a3b8", mb: 1.5 }}>
      <Typography component="div" sx={{ fontFamily: terminalFontFamily, fontSize: 12.5, color: "#67e8f9" }}>
        repo-control terminal
      </Typography>
      <Typography component="div" sx={{ fontFamily: terminalFontFamily, fontSize: 12.5, wordBreak: "break-word" }}>
        project: {projectName}
      </Typography>
      <Typography component="div" sx={{ fontFamily: terminalFontFamily, fontSize: 12.5, wordBreak: "break-all" }}>
        cwd: {projectPath}
      </Typography>
    </Box>
  );
}

function TerminalEntryBlock({ entry }: { entry: TerminalEntry }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={0.75} sx={{ minWidth: 0, color: "#e2e8f0" }}>
        <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 12.5, color: "#22d3ee" }}>
          $
        </Typography>
        <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 12.5, wordBreak: "break-word" }}>
          {entry.command}
        </Typography>
      </Stack>

      {entry.result ? (
        <>
          {entry.result.output ? (
            <Box
              component="pre"
              sx={{
                m: 0,
                mt: 0.35,
                color: entry.result.ok ? "#dbeafe" : "#fecaca",
                fontFamily: terminalFontFamily,
                fontSize: 12.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {entry.result.output}
            </Box>
          ) : (
            <Typography component="div" sx={{ mt: 0.35, fontFamily: terminalFontFamily, fontSize: 12.5, color: "#86efac" }}>
              done
            </Typography>
          )}
          <Typography component="div" sx={{ mt: 0.35, fontFamily: terminalFontFamily, fontSize: 11.5, color: "#64748b" }}>
            exit {entry.result.exitCode ?? "n/a"} - {entry.result.durationMs}ms
          </Typography>
        </>
      ) : (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.6, color: "#94a3b8" }}>
          <CircularProgress color="inherit" size={12} />
          <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 12 }}>
            running
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function Prompt({ projectName, promptPath }: { projectName: string; promptPath: string }) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
      <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 13, color: "#67e8f9" }}>
        repo-control
      </Typography>
      <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 13, color: "#94a3b8" }}>
        @
      </Typography>
      <Typography
        component="span"
        noWrap
        sx={{ maxWidth: { xs: 78, sm: 120, md: 160 }, fontFamily: terminalFontFamily, fontSize: 13, color: "#86efac" }}
      >
        {projectName}
      </Typography>
      <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 13, color: "#94a3b8" }}>
        :
      </Typography>
      <Typography
        component="span"
        noWrap
        sx={{ maxWidth: { xs: 72, sm: 140, md: 220 }, fontFamily: terminalFontFamily, fontSize: 13, color: "#bfdbfe" }}
      >
        {promptPath}
      </Typography>
      <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 13, color: "#94a3b8" }}>
        $
      </Typography>
    </Stack>
  );
}

function appendHistory(history: string[], command: string): string[] {
  const nextHistory = history[history.length - 1] === command ? history : [...history, command];

  return nextHistory.slice(-50);
}

function getPromptPath(projectPath: string): string {
  const normalizedPath = projectPath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments.length <= 2) {
    return normalizedPath;
  }

  return `.../${segments.slice(-2).join("/")}`;
}
