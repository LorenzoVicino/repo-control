import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  closeContainerSession,
  openContainerExecSession,
  openContainerLogSession,
  readContainerSession,
  sendContainerSessionInput
} from "../../api/docker";
import type { ContainerSession, ContainerSessionKind, DockerContainer } from "../../types/docker";

// Fast enough that typing a command feels answered, slow enough that an idle dialog is not
// a busy loop against the local API.
const SESSION_POLL_INTERVAL_MS = 450;
const MAX_TRANSCRIPT_CHARACTERS = 200_000;
// How close to the end still counts as "reading the tail". Wide enough that a line arriving
// mid-scroll does not unpin the view, narrow enough that scrolling up to read does.
const PINNED_TO_BOTTOM_THRESHOLD_PX = 120;
const COMMAND_HISTORY_LIMIT = 50;

type ContainerConsoleDialogProps = {
  container: DockerContainer | null;
  initialKind: ContainerSessionKind;
  onClose: () => void;
};

type SessionState = {
  session: ContainerSession | null;
  transcript: string;
  truncated: boolean;
  error: string | null;
  isOpening: boolean;
};

const EMPTY_SESSION_STATE: SessionState = {
  session: null,
  transcript: "",
  truncated: false,
  error: null,
  isOpening: false
};

export function ContainerConsoleDialog({ container, initialKind, onClose }: ContainerConsoleDialogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = React.useState<ContainerSessionKind>(initialKind);
  const isOpen = container !== null;

  React.useEffect(() => {
    if (isOpen) setKind(initialKind);
  }, [initialKind, isOpen, container?.id]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="container-console-title"
    >
      {container ? (
        <>
          <DialogTitle id="container-console-title" sx={{ pb: 1 }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="overline" color="primary.main" sx={{ display: "block" }}>
                  {t("docker.console.eyebrow")}
                </Typography>
                <Typography component="span" variant="h3" noWrap sx={{ display: "block" }}>
                  {container.composeService ?? container.name}
                </Typography>
                <Typography
                  color="text.secondary"
                  noWrap
                  sx={{ mt: 0.25, fontFamily: "var(--rc-font-mono)", fontSize: 10.5 }}
                >
                  {container.name} · {container.image}
                </Typography>
              </Box>
              <IconButton size="small" onClick={onClose} aria-label={t("common.close")}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </DialogTitle>

          <Tabs
            value={kind}
            onChange={(_, nextKind: ContainerSessionKind) => setKind(nextKind)}
            aria-label={t("docker.console.tabsAriaLabel")}
            sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider", minHeight: 38 }}
          >
            <Tab value="exec" label={t("docker.console.shellTab")} sx={{ minHeight: 38 }} />
            <Tab value="logs" label={t("docker.console.logsTab")} sx={{ minHeight: 38 }} />
          </Tabs>

          <DialogContent sx={{ p: 0 }}>
            {/* Both panes stay mounted: a shell keeps its working directory and history
                while the logs tab is on screen. */}
            <ContainerSessionPane
              containerId={container.id}
              kind="exec"
              active={kind === "exec"}
              hidden={kind !== "exec"}
            />
            <ContainerSessionPane
              containerId={container.id}
              kind="logs"
              active={kind === "logs"}
              hidden={kind !== "logs"}
            />
          </DialogContent>
        </>
      ) : null}
    </Dialog>
  );
}

function ContainerSessionPane({
  containerId,
  kind,
  active,
  hidden
}: {
  containerId: string;
  kind: ContainerSessionKind;
  active: boolean;
  hidden: boolean;
}) {
  const { t } = useTranslation();
  const [restartToken, setRestartToken] = React.useState(0);
  // Opened on first visit and kept open afterwards, so switching tabs does not throw away
  // a shell; only polling follows the visible tab.
  const [hasBeenActive, setHasBeenActive] = React.useState(active);
  const [state, setState] = React.useState<SessionState>(EMPTY_SESSION_STATE);
  const [command, setCommand] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);
  const [inputError, setInputError] = React.useState<string | null>(null);
  const transcriptRef = React.useRef<HTMLPreElement | null>(null);
  // Starts pinned: `docker logs --tail` arrives as one large chunk, and the newest lines are
  // at its end, so the first thing shown has to be the bottom of it.
  const isPinnedToBottomRef = React.useRef(true);
  const cursorRef = React.useRef(0);
  const sessionIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (active) setHasBeenActive(true);
  }, [active]);

  const enabled = hasBeenActive;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setState({ ...EMPTY_SESSION_STATE, isOpening: true });
    cursorRef.current = 0;
    isPinnedToBottomRef.current = true;

    async function openSession(): Promise<void> {
      try {
        const session =
          kind === "exec"
            ? await openContainerExecSession(containerId)
            : await openContainerLogSession(containerId);

        if (cancelled) {
          // The pane went away while the request was in flight; the process would otherwise
          // stay alive until it timed out.
          void closeContainerSession(session.id).catch(() => undefined);
          return;
        }

        sessionIdRef.current = session.id;
        setState({ session, transcript: "", truncated: false, error: null, isOpening: false });
      } catch (error) {
        if (!cancelled) {
          setState({
            ...EMPTY_SESSION_STATE,
            error: error instanceof Error ? error.message : t("docker.console.openFailed")
          });
        }
      }
    }

    void openSession();

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;

      if (sessionId) {
        void closeContainerSession(sessionId).catch(() => undefined);
      }
    };
  }, [containerId, enabled, kind, restartToken, t]);

  const sessionId = state.session?.id ?? null;
  const isRunning = state.session?.running ?? false;

  React.useEffect(() => {
    if (!active || !sessionId || !isRunning) {
      return;
    }

    const activeSessionId = sessionId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(): Promise<void> {
      try {
        const read = await readContainerSession(activeSessionId, cursorRef.current);

        if (cancelled) {
          return;
        }

        cursorRef.current = read.cursor;
        setState((previous) => ({
          session: read,
          transcript: appendTranscript(previous.transcript, read.chunk),
          truncated: previous.truncated || read.truncated,
          error: null,
          isOpening: false
        }));

        if (read.running) {
          timer = setTimeout(() => void poll(), SESSION_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            error: error instanceof Error ? error.message : t("docker.console.readFailed")
          }));
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, isRunning, sessionId, t]);

  // Whether the view follows the tail is the reader's, tracked from their own scrolling
  // rather than inferred from the current position: measuring it at append time cannot tell
  // "has not scrolled yet" from "scrolled far up", and the first chunk is always far from
  // the bottom the moment it lands.
  function handleTranscriptScroll(event: React.UIEvent<HTMLPreElement>): void {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isPinnedToBottomRef.current = distanceFromBottom < PINNED_TO_BOTTOM_THRESHOLD_PX;
  }

  React.useLayoutEffect(() => {
    const element = transcriptRef.current;

    // A hidden pane has no layout to scroll, so the pin is applied when its tab comes back.
    if (!element || hidden || !isPinnedToBottomRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [state.transcript, hidden]);

  async function submitCommand(): Promise<void> {
    const trimmedCommand = command.trim();

    if (!trimmedCommand || !sessionId || !isRunning) {
      return;
    }

    setCommand("");
    setHistoryIndex(null);
    setInputError(null);
    setHistory((previous) => [trimmedCommand, ...previous.filter((entry) => entry !== trimmedCommand)].slice(0, COMMAND_HISTORY_LIMIT));
    // Echoed locally: the shell reads a pipe rather than a terminal, so it never echoes the
    // command itself and the transcript would otherwise show answers without questions.
    setState((previous) => ({
      ...previous,
      transcript: appendTranscript(previous.transcript, `$ ${trimmedCommand}\n`)
    }));

    try {
      await sendContainerSessionInput(sessionId, `${trimmedCommand}\n`);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : t("docker.console.sendFailed"));
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitCommand();
      return;
    }

    if (event.key === "ArrowUp" && history.length > 0) {
      event.preventDefault();
      const nextIndex = historyIndex === null ? 0 : Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex] ?? "");
      return;
    }

    if (event.key === "ArrowDown" && historyIndex !== null) {
      event.preventDefault();
      const nextIndex = historyIndex - 1;

      if (nextIndex < 0) {
        setHistoryIndex(null);
        setCommand("");
        return;
      }

      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex] ?? "");
    }
  }

  const statusLabel = state.isOpening
    ? t("docker.console.opening")
    : isRunning
      ? kind === "exec"
        ? t("docker.console.shellReady", { shell: state.session?.shell ?? "sh" })
        : t("docker.console.following")
      : state.session
        ? t("docker.console.ended", { code: state.session.exitCode ?? 0 })
        : t("docker.console.notStarted");

  return (
    <Box hidden={hidden} sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1, minWidth: 0 }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 6,
              height: 6,
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: isRunning ? "success.main" : state.error ? "error.main" : "text.disabled",
              animation: state.isOpening ? "rc-pulse 1.4s ease-in-out infinite" : "none"
            }}
          />
          <Typography
            color="text.secondary"
            noWrap
            sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10 }}
          >
            {statusLabel}
          </Typography>
          {state.session ? (
            <Chip
              size="small"
              variant="outlined"
              label={state.session.command}
              sx={{ display: { xs: "none", md: "inline-flex" }, maxWidth: 340, color: "text.disabled" }}
            />
          ) : null}
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title={t("docker.console.clear")}>
            <IconButton
              size="small"
              aria-label={t("docker.console.clear")}
              onClick={() => {
                isPinnedToBottomRef.current = true;
                setState((previous) => ({ ...previous, transcript: "", truncated: false }));
              }}
            >
              <DeleteSweepOutlinedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("docker.console.restart")}>
            <IconButton
              size="small"
              aria-label={t("docker.console.restart")}
              onClick={() => setRestartToken((token) => token + 1)}
            >
              <RestartAltRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {state.error ? (
        <Alert severity="error" variant="outlined" sx={{ mb: 1, fontSize: 12 }}>
          {state.error}
        </Alert>
      ) : null}

      {state.truncated ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 1, fontSize: 11.5 }}>
          {t("docker.console.truncated")}
        </Alert>
      ) : null}

      <Box
        component="pre"
        ref={transcriptRef}
        onScroll={handleTranscriptScroll}
        tabIndex={0}
        aria-label={t(kind === "exec" ? "docker.console.shellTranscript" : "docker.console.logsTranscript")}
        sx={{
          m: 0,
          p: 1.25,
          height: { xs: "44vh", md: "48vh" },
          overflow: "auto",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--rc-radius-control)",
          bgcolor: "background.default",
          color: "text.secondary",
          fontFamily: "var(--rc-font-mono)",
          fontSize: 11.5,
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere"
        }}
      >
        {state.transcript || (state.isOpening ? "" : t("docker.console.noOutputYet"))}
      </Box>

      {kind === "exec" ? (
        <>
          <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1.25 }}>
            <TextField
              fullWidth
              size="small"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isRunning}
              placeholder={t("docker.console.commandPlaceholder")}
              inputProps={{
                "aria-label": t("docker.console.commandLabel"),
                spellCheck: false,
                autoCapitalize: "off",
                autoCorrect: "off"
              }}
              sx={{ "& .MuiInputBase-input": { fontFamily: "var(--rc-font-mono)", fontSize: 12 } }}
            />
            <Tooltip title={t("docker.console.send")}>
              <span>
                <IconButton
                  aria-label={t("docker.console.send")}
                  disabled={!isRunning || !command.trim()}
                  onClick={() => void submitCommand()}
                  sx={{ mt: 0.15 }}
                >
                  {state.isOpening ? <CircularProgress size={16} /> : <SendRoundedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {inputError ? (
            <Typography color="error.main" sx={{ mt: 0.75, fontSize: 11 }}>
              {inputError}
            </Typography>
          ) : null}

          <Typography color="text.disabled" sx={{ mt: 0.75, fontSize: 10, lineHeight: 1.6 }}>
            {t("docker.console.noTtyNote")}
          </Typography>
        </>
      ) : (
        <Typography color="text.disabled" sx={{ mt: 1, fontSize: 10, lineHeight: 1.6 }}>
          {t("docker.console.logsNote")}
        </Typography>
      )}
    </Box>
  );
}

function appendTranscript(current: string, chunk: string): string {
  if (!chunk) {
    return current;
  }

  const combined = current + chunk;

  return combined.length > MAX_TRANSCRIPT_CHARACTERS
    ? combined.slice(combined.length - MAX_TRANSCRIPT_CHARACTERS)
    : combined;
}
