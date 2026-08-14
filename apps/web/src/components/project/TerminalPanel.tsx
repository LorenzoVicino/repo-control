import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import WrapTextRoundedIcon from "@mui/icons-material/WrapTextRounded";
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputBase,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import React from "react";
import {
  cancelTerminalCommand,
  fetchTerminalSuggestions,
  runTerminalCommand
} from "../../api/projects";
import type { CommandResult } from "../../types/common";
import { commandErrorResult } from "../../utils/commandResult";

type TerminalPanelProps = {
  projectId: string;
  projectName: string;
  projectPath: string;
  branch: string;
  hasDockerCompose: boolean;
  composeServiceCount?: number;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

type TerminalEntry = {
  id: string;
  command: string;
  result: CommandResult | null;
  cancelRequested: boolean;
};

type CopyState = "idle" | "copied" | "error";

const MAX_TERMINAL_ENTRIES = 100;
const MAX_HISTORY_ENTRIES = 50;
const terminalFontFamily = "var(--rc-font-mono)";

export function TerminalPanel({
  projectId,
  projectName,
  projectPath,
  branch,
  hasDockerCompose,
  composeServiceCount,
  onResult,
  onCompleted
}: TerminalPanelProps) {
  const [command, setCommand] = React.useState("");
  const [entries, setEntries] = React.useState<TerminalEntry[]>([]);
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = React.useState<number | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [wrapOutput, setWrapOutput] = React.useState(true);
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);
  const [copyState, setCopyState] = React.useState<CopyState>("idle");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [isFollowingOutput, setIsFollowingOutput] = React.useState(true);
  const outputRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const activeStartedAtRef = React.useRef<number | null>(null);
  const activeEntryIdRef = React.useRef<string | null>(null);
  const shouldRestoreInputFocusRef = React.useRef(false);
  const followOutputRef = React.useRef(true);
  const promptPath = getPromptPath(projectPath);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, [projectId]);

  React.useEffect(() => {
    const normalizedInput = command.trim();
    let active = true;

    if (!normalizedInput) {
      setSuggestions([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchTerminalSuggestions(projectId, normalizedInput)
        .then((response) => {
          if (active) setSuggestions(response.suggestions);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        });
    }, 160);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [command, projectId]);

  React.useEffect(() => {
    if (!isRunning) return undefined;

    const updateElapsed = () => {
      setElapsedMs(activeStartedAtRef.current ? Date.now() - activeStartedAtRef.current : 0);
    };
    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [isRunning]);

  React.useEffect(() => {
    const outputElement = outputRef.current;
    if (!outputElement || !followOutputRef.current) return;

    outputElement.scrollTop = outputElement.scrollHeight;
  }, [entries, isRunning]);

  React.useEffect(() => {
    if (!isRunning && shouldRestoreInputFocusRef.current) {
      shouldRestoreInputFocusRef.current = false;
      inputRef.current?.focus();
    }
  }, [isRunning]);

  React.useEffect(() => {
    if (copyState === "idle") return undefined;
    const timeoutId = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  async function runCommand() {
    const nextCommand = command.trim();

    if (!nextCommand || isRunning) return;

    setIsRunning(true);
    setCommand("");
    setSuggestions([]);
    setHistoryCursor(null);
    setHistory((currentHistory) => appendHistory(currentHistory, nextCommand));
    activeStartedAtRef.current = Date.now();
    setElapsedMs(0);

    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeEntryIdRef.current = entryId;
    setEntries((currentEntries) =>
      [...currentEntries, { id: entryId, command: nextCommand, result: null, cancelRequested: false }]
        .slice(-MAX_TERMINAL_ENTRIES)
    );

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
      activeStartedAtRef.current = null;
      activeEntryIdRef.current = null;
      shouldRestoreInputFocusRef.current = true;
      setIsRunning(false);
    }
  }

  async function cancelCommand() {
    if (!isRunning || isCancelling) return;
    const activeEntryId = activeEntryIdRef.current;
    setIsCancelling(true);
    setEntries((currentEntries) => currentEntries.map((entry) => (
      entry.id === activeEntryId ? { ...entry, cancelRequested: true } : entry
    )));
    try {
      await cancelTerminalCommand(projectId);
    } catch (error) {
      setEntries((currentEntries) => currentEntries.map((entry) => (
        entry.id === activeEntryId ? { ...entry, cancelRequested: false } : entry
      )));
      onResult(commandErrorResult("Cancel command", error));
    } finally {
      setIsCancelling(false);
    }
  }

  async function copyTranscript() {
    try {
      await writeClipboard(serializeTranscript(projectName, projectPath, entries));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function clearTranscript() {
    setEntries([]);
    setClearDialogOpen(false);
    setIsFollowingOutput(true);
    followOutputRef.current = true;
  }

  function recallHistory(nextCursor: number | null) {
    setHistoryCursor(nextCursor);
    setCommand(nextCursor === null ? "" : history[nextCursor] ?? "");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      if (entries.length > 0 && !isRunning) setClearDialogOpen(true);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runCommand();
      return;
    }

    if (event.key === "Tab" && suggestions.length > 0) {
      event.preventDefault();
      setCommand(suggestions[0]);
      setHistoryCursor(null);
      return;
    }

    if (event.key === "ArrowUp" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (history.length === 0) return;
      recallHistory(historyCursor === null ? history.length - 1 : Math.max(0, historyCursor - 1));
      return;
    }

    if (event.key === "ArrowDown" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (historyCursor === null) return;
      const nextCursor = historyCursor + 1;
      recallHistory(nextCursor >= history.length ? null : nextCursor);
    }
  }

  function followLatestOutput() {
    const outputElement = outputRef.current;
    followOutputRef.current = true;
    setIsFollowingOutput(true);
    if (outputElement) outputElement.scrollTop = outputElement.scrollHeight;
  }

  return (
    <>
      <Paper
        component="section"
        aria-label={`Terminale repository ${projectName}`}
        variant="outlined"
        sx={{
          minHeight: { xs: 620, lg: 590 },
          height: { xs: "auto", lg: "clamp(590px, calc(100dvh - 190px), 760px)" },
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 310px" },
          bgcolor: "var(--rc-surface-1)",
          backgroundImage: "none",
          borderColor: "var(--rc-border-strong)",
          borderRadius: "var(--rc-radius-panel)"
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            minHeight: { xs: 560, lg: 0 },
            display: "grid",
            gridTemplateRows: "auto minmax(300px, 1fr) auto",
            borderRight: { lg: "1px solid var(--rc-border)" }
          }}
        >
          <TerminalToolbar
            commandCount={entries.length}
            historyCount={history.length}
            isRunning={isRunning}
            isCancelling={isCancelling}
            elapsedMs={elapsedMs}
            wrapOutput={wrapOutput}
            copyState={copyState}
            canCopy={entries.length > 0}
            canClear={entries.length > 0 && !isRunning}
            onToggleWrap={() => setWrapOutput((current) => !current)}
            onCopy={() => void copyTranscript()}
            onClear={() => setClearDialogOpen(true)}
            onStop={() => void cancelCommand()}
          />

          <Box sx={{ position: "relative", minHeight: 0, bgcolor: "background.default" }}>
            <Box
              ref={outputRef}
              role="log"
              aria-live="polite"
              onScroll={(event) => {
                const element = event.currentTarget;
                const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
                followOutputRef.current = isAtBottom;
                setIsFollowingOutput(isAtBottom);
              }}
              sx={{
                position: "absolute",
                inset: 0,
                overflow: "auto",
                px: { xs: 1.5, sm: 2.25 },
                py: 1.75,
                scrollbarWidth: "thin"
              }}
            >
              {entries.length === 0 ? <TerminalEmptyState /> : null}
              {entries.map((entry) => (
                <TerminalEntryBlock key={entry.id} entry={entry} wrapOutput={wrapOutput} />
              ))}
            </Box>
            {!isFollowingOutput ? (
              <Button
                size="small"
                variant="contained"
                onClick={followLatestOutput}
                sx={{ position: "absolute", right: 14, bottom: 12, boxShadow: 2 }}
              >
                Torna all’output
              </Button>
            ) : null}
          </Box>

          <TerminalComposer
            command={command}
            inputRef={inputRef}
            promptPath={promptPath}
            isRunning={isRunning}
            suggestions={suggestions}
            onCommandChange={(nextCommand) => {
              setCommand(nextCommand);
              setHistoryCursor(null);
            }}
            onKeyDown={handleKeyDown}
            onRun={() => void runCommand()}
          />
        </Box>

        <TerminalContextRail
          projectName={projectName}
          projectPath={projectPath}
          branch={branch}
          hasDockerCompose={hasDockerCompose}
          composeServiceCount={composeServiceCount}
          command={command}
          suggestions={suggestions}
          history={history}
          onSelectCommand={(nextCommand) => {
            setCommand(nextCommand);
            setHistoryCursor(null);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
          onClearHistory={() => {
            setHistory([]);
            setHistoryCursor(null);
          }}
        />
      </Paper>

      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pulisci il transcript?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Verranno rimossi i {entries.length} blocchi di output visibili. La cronologia dei comandi resterà disponibile.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)} color="inherit">Annulla</Button>
          <Button onClick={clearTranscript} color="error" variant="contained">Pulisci transcript</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type TerminalToolbarProps = {
  commandCount: number;
  historyCount: number;
  isRunning: boolean;
  isCancelling: boolean;
  elapsedMs: number;
  wrapOutput: boolean;
  copyState: CopyState;
  canCopy: boolean;
  canClear: boolean;
  onToggleWrap: () => void;
  onCopy: () => void;
  onClear: () => void;
  onStop: () => void;
};

function TerminalToolbar({
  commandCount,
  historyCount,
  isRunning,
  isCancelling,
  elapsedMs,
  wrapOutput,
  copyState,
  canCopy,
  canClear,
  onToggleWrap,
  onCopy,
  onClear,
  onStop
}: TerminalToolbarProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      useFlexGap
      flexWrap="wrap"
      sx={{ minHeight: 42, px: { xs: 1.25, sm: 2.25 }, py: 0.65, gap: 0.5, borderBottom: "1px solid var(--rc-border)" }}
    >
      <Typography variant="overline" color="text.disabled">Sessione</Typography>
      <Typography sx={{ mr: "auto", color: "text.secondary", fontFamily: terminalFontFamily, fontSize: 10.5 }}>
        {commandCount} comandi · scrollback {MAX_TERMINAL_ENTRIES} · cronologia {historyCount}/{MAX_HISTORY_ENTRIES}
      </Typography>
      <ToolbarAction
        label="A capo"
        icon={<WrapTextRoundedIcon />}
        active={wrapOutput}
        onClick={onToggleWrap}
      />
      <ToolbarAction
        label={copyState === "copied" ? "Copiato" : copyState === "error" ? "Errore copia" : "Copia tutto"}
        icon={<ContentCopyRoundedIcon />}
        disabled={!canCopy}
        onClick={onCopy}
      />
      <ToolbarAction label="Pulisci" icon={<DeleteSweepOutlinedIcon />} disabled={!canClear} onClick={onClear} />
      {isRunning ? (
        <Button
          size="small"
          color="error"
          variant="outlined"
          aria-label="Interrompi comando"
          onClick={onStop}
          disabled={isCancelling}
          startIcon={isCancelling ? <CircularProgress size={13} color="inherit" /> : <StopCircleOutlinedIcon />}
          sx={{ ml: 0.5, borderStyle: "dashed", bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) }}
        >
          Stop <Box component="span" aria-hidden="true">· {formatElapsed(elapsedMs)}</Box>
        </Button>
      ) : null}
    </Stack>
  );
}

function ToolbarAction({
  label,
  icon,
  active,
  disabled = false,
  onClick
}: {
  label: string;
  icon: React.ReactElement;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      sx={{
        minHeight: 28,
        px: 0.75,
        gap: 0.55,
        borderRadius: "var(--rc-radius-control)",
        color: active ? "primary.light" : "text.secondary",
        bgcolor: active ? "var(--rc-accent-tint)" : "transparent",
        "&:hover": { color: "text.primary", bgcolor: "var(--rc-surface-2)" },
        "&.Mui-disabled": { opacity: 0.38 },
        "& svg": { fontSize: 15 }
      }}
    >
      {icon}
      <Typography component="span" sx={{ display: { xs: "none", sm: "inline" }, fontSize: 11.5 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
}

function TerminalEmptyState() {
  return (
    <Stack direction="row" spacing={0.9} alignItems="center" sx={{ color: "text.disabled" }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "primary.main" }} />
      <Typography sx={{ fontFamily: terminalFontFamily, fontSize: 11.5, lineHeight: 1.7 }}>
        repo-control terminal · scoped a questa repository · i comandi partono dalla cwd indicata
      </Typography>
    </Stack>
  );
}

const TerminalEntryBlock = React.memo(function TerminalEntryBlock({
  entry,
  wrapOutput
}: {
  entry: TerminalEntry;
  wrapOutput: boolean;
}) {
  const status = getEntryStatus(entry);
  const output = entry.result?.output ?? "";

  return (
    <Box
      sx={{
        mb: 1.75,
        pl: 1.5,
        borderLeft: "2px solid",
        borderColor: status.color,
        contentVisibility: "auto",
        containIntrinsicSize: "auto 82px"
      }}
    >
      <Stack direction="row" alignItems="baseline" spacing={1.1} sx={{ minWidth: 0 }}>
        <Typography component="span" sx={{ color: "primary.light", fontFamily: terminalFontFamily, fontSize: 12.5, fontWeight: 600 }}>
          $
        </Typography>
        <Typography sx={{ minWidth: 0, flexGrow: 1, fontFamily: terminalFontFamily, fontSize: 12.5, fontWeight: 500, wordBreak: "break-word" }}>
          {entry.command}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.6} sx={{ color: status.color, flexShrink: 0 }}>
          {entry.result ? (
            <Box aria-hidden="true" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "currentColor" }} />
          ) : (
            <CircularProgress color="inherit" size={10} />
          )}
          <Typography component="span" sx={{ fontFamily: terminalFontFamily, fontSize: 10.5, fontWeight: 500 }}>
            {status.label}
          </Typography>
        </Stack>
        <Typography sx={{ width: 52, flexShrink: 0, textAlign: "right", color: "text.disabled", fontFamily: terminalFontFamily, fontSize: 10.5 }}>
          {entry.result ? formatDuration(entry.result.durationMs) : "—"}
        </Typography>
      </Stack>

      {entry.result ? (
        output ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 0.65,
              maxWidth: "100%",
              overflowX: "auto",
              color: entry.result.ok ? "text.secondary" : "error.light",
              fontFamily: terminalFontFamily,
              fontSize: 11.5,
              lineHeight: 1.65,
              whiteSpace: wrapOutput ? "pre-wrap" : "pre",
              overflowWrap: wrapOutput ? "anywhere" : "normal"
            }}
          >
            {output}
          </Box>
        ) : (
          <Typography sx={{ mt: 0.55, color: "success.main", fontFamily: terminalFontFamily, fontSize: 11.5 }}>
            Comando completato senza output.
          </Typography>
        )
      ) : (
        <Box sx={{ width: "min(320px, 80%)", height: 3, mt: 1, overflow: "hidden", borderRadius: 2, bgcolor: "var(--rc-surface-3)" }}>
          <Box
            sx={{
              width: "45%",
              height: "100%",
              bgcolor: "primary.main",
              backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,.42), transparent)",
              animation: "rc-sweep 1.6s linear infinite",
              "@media (prefers-reduced-motion: reduce)": { animation: "none" }
            }}
          />
        </Box>
      )}
    </Box>
  );
});

type TerminalComposerProps = {
  command: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  promptPath: string;
  isRunning: boolean;
  suggestions: string[];
  onCommandChange: (command: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onRun: () => void;
};

function TerminalComposer({
  command,
  inputRef,
  promptPath,
  isRunning,
  suggestions,
  onCommandChange,
  onKeyDown,
  onRun
}: TerminalComposerProps) {
  return (
    <Box sx={{ px: { xs: 1.25, sm: 2.25 }, py: 1.35, borderTop: "1px solid var(--rc-border)" }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        onClick={() => inputRef.current?.focus()}
        sx={{
          p: "8px 10px",
          minHeight: 42,
          border: "1px solid",
          borderColor: "primary.main",
          borderRadius: "var(--rc-radius-control)",
          bgcolor: "var(--rc-surface-2)",
          boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.13)}`
        }}
      >
        <Typography
          noWrap
          title={promptPath}
          sx={{ maxWidth: { xs: 112, sm: 210 }, pt: 0.35, flexShrink: 0, color: "primary.light", fontFamily: terminalFontFamily, fontSize: 12 }}
        >
          {promptPath} $
        </Typography>
        <InputBase
          inputRef={inputRef}
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="type a command"
          multiline
          maxRows={4}
          fullWidth
          inputProps={{ "aria-label": "Comando terminale" }}
          sx={{
            minWidth: 0,
            color: "text.primary",
            fontFamily: terminalFontFamily,
            fontSize: 12.5,
            lineHeight: 1.55,
            "& textarea": { p: 0 },
            "& textarea::placeholder": { color: "text.disabled", opacity: 1 }
          }}
        />
        <Typography
          aria-hidden="true"
          sx={{ display: { xs: "none", md: "block" }, pt: 0.4, flexShrink: 0, color: "text.disabled", fontFamily: terminalFontFamily, fontSize: 9.5 }}
        >
          Enter run · Shift Enter newline
        </Typography>
        <Button
          size="small"
          variant="outlined"
          aria-label="Run command"
          disabled={isRunning || command.trim().length === 0}
          onClick={(event) => {
            event.stopPropagation();
            onRun();
          }}
          startIcon={<PlayArrowRoundedIcon />}
          sx={{ flexShrink: 0 }}
        >
          Run
        </Button>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minHeight: 22, mt: 0.75, color: "text.disabled" }}>
        <InfoOutlinedIcon sx={{ fontSize: 12 }} />
        <Typography sx={{ fontSize: 10.5 }}>
          {isRunning ? "Processo attivo: puoi preparare il prossimo comando." : "Un comando alla volta."}
        </Typography>
        <Typography sx={{ ml: "auto !important", display: { xs: "none", sm: "block" }, fontSize: 10.5 }}>
          ↑↓ cronologia · Tab suggerimento · Ctrl L pulisci
        </Typography>
        {suggestions.length > 0 ? (
          <Typography sx={{ display: { xs: "none", md: "block" }, color: "primary.light", fontSize: 10.5 }}>
            {suggestions.length} suggerimenti
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

type TerminalContextRailProps = {
  projectName: string;
  projectPath: string;
  branch: string;
  hasDockerCompose: boolean;
  composeServiceCount?: number;
  command: string;
  suggestions: string[];
  history: string[];
  onSelectCommand: (command: string) => void;
  onClearHistory: () => void;
};

function TerminalContextRail({
  projectName,
  projectPath,
  branch,
  hasDockerCompose,
  composeServiceCount,
  command,
  suggestions,
  history,
  onSelectCommand,
  onClearHistory
}: TerminalContextRailProps) {
  const recentHistory = [...history].reverse().slice(0, 8);

  return (
    <Box
      component="aside"
      aria-label="Contesto terminale"
      sx={{
        minWidth: 0,
        bgcolor: "var(--rc-surface-1)",
        display: { xs: "grid", sm: "grid", lg: "block" },
        gridTemplateColumns: { sm: "repeat(3, minmax(0, 1fr))" },
        overflowY: { lg: "auto" },
        borderTop: { xs: "1px solid var(--rc-border)", lg: 0 }
      }}
    >
      <RailSection title="Contesto">
        <Box component="dl" sx={{ m: 0, display: "grid", gap: 0.7 }}>
          <ContextRow label="Repository" value={projectName} />
          <ContextRow label="Branch" value={branch || "—"} />
          <ContextRow label="Cwd" value={projectPath} truncateFromStart />
          <ContextRow
            label="Compose"
            value={hasDockerCompose
              ? composeServiceCount === undefined
                ? "configurato"
                : `${composeServiceCount} ${composeServiceCount === 1 ? "servizio" : "servizi"}`
              : "non configurato"}
          />
        </Box>
        <Box sx={{ mt: 1.25, p: 1, border: "1px solid var(--rc-border)", borderLeft: "3px solid", borderLeftColor: "primary.main", borderRadius: "var(--rc-radius-control)", bgcolor: "var(--rc-surface-2)" }}>
          <Typography color="text.secondary" sx={{ fontSize: 10.5, lineHeight: 1.55 }}>
            La sessione resta disponibile mentre questa repository rimane aperta.
          </Typography>
        </Box>
      </RailSection>

      <RailSection title="Suggerimenti" icon={<AutoAwesomeOutlinedIcon />}>
        {suggestions.length > 0 ? (
          <Stack spacing={0.65}>
            {suggestions.slice(0, 5).map((suggestion) => (
              <CommandChoice key={suggestion} command={suggestion} onSelect={onSelectCommand} />
            ))}
          </Stack>
        ) : (
          <Typography color="text.disabled" sx={{ fontSize: 10.5, lineHeight: 1.55 }}>
            {command.trim() ? "Nessuna corrispondenza nella memoria dei comandi." : "Digita l’inizio di un comando per cercare nella memoria della repository."}
          </Typography>
        )}
      </RailSection>

      <RailSection
        title="Cronologia"
        icon={<HistoryRoundedIcon />}
        action={history.length > 0 ? (
          <Button size="small" color="inherit" aria-label="Pulisci cronologia" onClick={onClearHistory}>Pulisci</Button>
        ) : undefined}
      >
        {recentHistory.length > 0 ? (
          <Stack spacing={0.15}>
            {recentHistory.map((historyCommand, index) => (
              <ButtonBase
                key={`${historyCommand}-${index}`}
                onClick={() => onSelectCommand(historyCommand)}
                title={historyCommand}
                sx={{ width: "100%", minHeight: 27, px: 0.5, justifyContent: "flex-start", borderRadius: 0.75, color: "text.secondary", "&:hover": { color: "text.primary", bgcolor: "var(--rc-surface-2)" } }}
              >
                <Typography noWrap sx={{ fontFamily: terminalFontFamily, fontSize: 10.5 }}>
                  {historyCommand}
                </Typography>
              </ButtonBase>
            ))}
          </Stack>
        ) : (
          <Typography color="text.disabled" sx={{ fontSize: 10.5 }}>Nessun comando in questa sessione.</Typography>
        )}
      </RailSection>
    </Box>
  );
}

function RailSection({
  title,
  icon,
  action,
  children
}: {
  title: string;
  icon?: React.ReactElement;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minWidth: 0, p: 1.75, borderBottom: { xs: 0, sm: 0, lg: "1px solid var(--rc-border)" }, borderRight: { sm: "1px solid var(--rc-border)", lg: 0 }, "&:last-of-type": { borderRight: 0 } }}>
      <Stack direction="row" alignItems="center" spacing={0.65} sx={{ minHeight: 22, mb: 0.85 }}>
        {icon ? React.cloneElement(icon, { sx: { fontSize: 13, color: "primary.light" } }) : null}
        <Typography variant="overline" color="text.disabled">{title}</Typography>
        {action ? <Box sx={{ ml: "auto !important" }}>{action}</Box> : null}
      </Stack>
      {children}
    </Box>
  );
}

function ContextRow({ label, value, truncateFromStart = false }: { label: string; value: string; truncateFromStart?: boolean }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "62px minmax(0, 1fr)", gap: 0.75 }}>
      <Typography component="dt" color="text.disabled" sx={{ fontSize: 10.5 }}>{label}</Typography>
      <Typography
        component="dd"
        title={value}
        noWrap
        sx={{ m: 0, minWidth: 0, color: "text.secondary", fontFamily: terminalFontFamily, fontSize: 10.5, direction: truncateFromStart ? "rtl" : "ltr", textAlign: "left" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function CommandChoice({ command, onSelect }: { command: string; onSelect: (command: string) => void }) {
  return (
    <ButtonBase
      onClick={() => onSelect(command)}
      title={command}
      sx={{
        width: "100%",
        minHeight: 35,
        px: 1,
        justifyContent: "flex-start",
        border: "1px solid var(--rc-border)",
        borderRadius: "var(--rc-radius-control)",
        bgcolor: "var(--rc-surface-2)",
        color: "text.secondary",
        "&:hover": { color: "text.primary", borderColor: "primary.main", bgcolor: "var(--rc-accent-tint)" }
      }}
    >
      <Typography noWrap sx={{ fontFamily: terminalFontFamily, fontSize: 10.5 }}>{command}</Typography>
    </ButtonBase>
  );
}

function getEntryStatus(entry: TerminalEntry): { label: string; color: string } {
  if (!entry.result) {
    return entry.cancelRequested
      ? { label: "stopping", color: "error.main" }
      : { label: "running", color: "warning.main" };
  }
  if (entry.result.ok) {
    return { label: entry.result.exitCode === null ? "done" : `exit ${entry.result.exitCode}`, color: "success.main" };
  }
  return {
    label: entry.cancelRequested ? "interrotto" : entry.result.exitCode === null ? "failed" : `exit ${entry.result.exitCode}`,
    color: "error.main"
  };
}

function appendHistory(history: string[], command: string): string[] {
  const nextHistory = history[history.length - 1] === command ? history : [...history, command];
  return nextHistory.slice(-MAX_HISTORY_ENTRIES);
}

function serializeTranscript(projectName: string, projectPath: string, entries: TerminalEntry[]): string {
  const header = [`repo-control terminal`, `repository: ${projectName}`, `cwd: ${projectPath}`];
  const blocks = entries.map((entry) => {
    const result = entry.result;
    if (!result) return `$ ${entry.command}\nrunning`;
    const status = `exit ${result.exitCode ?? "n/a"} · ${formatDuration(result.durationMs)}`;
    return [`$ ${entry.command}`, result.output, status].filter(Boolean).join("\n");
  });
  return [...header, ...blocks].join("\n\n");
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

function formatElapsed(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
}

function getPromptPath(projectPath: string): string {
  const normalizedPath = projectPath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length <= 2) return normalizedPath;
  return `.../${segments.slice(-2).join("/")}`;
}
