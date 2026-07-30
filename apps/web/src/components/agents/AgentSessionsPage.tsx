import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import {
  Alert,
  alpha,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchAgentSessions, resumeAgentSession } from "../../api/agentSessions";
import type {
  AgentInstallation,
  AgentSessionProvider,
  AgentSessionSummary
} from "../../types/agentSessions";

type ProviderFilter = "all" | AgentSessionProvider;
type Notice = {
  severity: "success" | "error";
  message: string;
};

const PROVIDER_TONES: Record<AgentSessionProvider, "warning" | "primary" | "info"> = {
  claude: "warning",
  codex: "primary",
  gemini: "info"
};
const AGENT_PLACEHOLDERS: AgentInstallation[] = [
  { id: "claude", label: "Claude Code", installed: false, used: false, command: "claude", sessionCount: 0 },
  { id: "codex", label: "Codex", installed: false, used: false, command: "codex", sessionCount: 0 },
  { id: "gemini", label: "Gemini CLI", installed: false, used: false, command: "gemini", sessionCount: 0 }
];

export function AgentSessionsPage() {
  const [providerFilter, setProviderFilter] = React.useState<ProviderFilter>("all");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 320);
  const [resumingSessionKey, setResumingSessionKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ["agent-sessions", debouncedSearch],
    queryFn: () => fetchAgentSessions(debouncedSearch),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000
  });
  const agentsById = React.useMemo(
    () => new Map(data?.agents.map((agent) => [agent.id, agent]) ?? []),
    [data?.agents]
  );
  const filteredSessions = React.useMemo(() => {
    return dedupeSessions(data?.sessions ?? [])
      .filter((session) => providerFilter === "all" || session.provider === providerFilter)
      .sort(compareSessionsByRecentUse);
  }, [data?.sessions, providerFilter]);
  const totalSessionCount = data?.agents.reduce((total, agent) => total + agent.sessionCount, 0) ?? 0;
  const isSearchPending = search.trim() !== debouncedSearch || (isFetching && Boolean(search.trim()));

  async function handleResume(session: AgentSessionSummary) {
    const sessionKey = `${session.provider}:${session.id}`;
    setResumingSessionKey(sessionKey);
    setNotice(null);

    try {
      const result = await resumeAgentSession(session.provider, session.id, session.projectId);
      setNotice({ severity: "success", message: result.message });
    } catch (resumeError) {
      setNotice({
        severity: "error",
        message: resumeError instanceof Error
          ? resumeError.message
          : "Impossibile aprire la sessione nel terminale"
      });
    } finally {
      setResumingSessionKey(null);
    }
  }

  return (
    <Box component="section" aria-labelledby="agent-sessions-title">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography id="agent-sessions-title" component="h1" variant="h1">
              Agent sessions
            </Typography>
            {data ? <Chip size="small" variant="outlined" label={totalSessionCount} /> : null}
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, maxWidth: 760 }}>
            Storici locali di Codex, Claude Code e Gemini CLI collegati ai repository del workspace.
            Riprendi una conversazione nel suo contesto originale.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={isFetching ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon />}
          disabled={isFetching}
          onClick={() => void refetch()}
          sx={{ flexShrink: 0 }}
        >
          Rileva di nuovo
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error instanceof Error ? error.message : "Impossibile rilevare le sessioni degli agent"}
        </Alert>
      ) : null}

      {data?.warnings.length ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Rilevazione parziale: {data.warnings.join(" · ")}
        </Alert>
      ) : null}

      <Box
        aria-label="Agent rilevati"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          gap: 1,
          mt: 2.5
        }}
      >
        {(data?.agents ?? AGENT_PLACEHOLDERS).map((agent) => (
          <AgentStatusCard
            key={agent.id}
            agent={agent}
            active={providerFilter === agent.id}
            loading={isLoading}
            onSelect={() => setProviderFilter((current) => current === agent.id ? "all" : agent.id)}
          />
        ))}
      </Box>

      <Box
        component="search"
        aria-label="Ricerca nelle conversazioni degli agent"
        sx={(theme) => ({
          mt: 2.5,
          p: { xs: 1.25, sm: 1.5 },
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.28),
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.09)}, ${alpha(theme.palette.background.paper, 0.96)} 52%)`,
          boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.07)}`
        })}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }}>
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              width: 44,
              height: 44,
              flexShrink: 0,
              display: { xs: "none", sm: "grid" },
              placeItems: "center",
              borderRadius: 1.5,
              color: "primary.main",
              bgcolor: alpha(theme.palette.primary.main, 0.12)
            })}
          >
            <SearchRoundedIcon />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <TextField
              fullWidth
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca nei titoli e nel contenuto delle chat…"
              inputProps={{
                "aria-label": "Cerca nei titoli e nel contenuto delle chat",
                maxLength: 200
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {isSearchPending ? (
                      <CircularProgress size={18} aria-label="Ricerca in corso" />
                    ) : search ? (
                      <IconButton
                        size="small"
                        aria-label="Cancella ricerca"
                        onClick={() => setSearch("")}
                        edge="end"
                      >
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                )
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 1.5,
                  bgcolor: "background.paper"
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.65, ml: 0.25 }}>
              Ricerca locale nei transcript: alla pagina arriva soltanto il frammento corrispondente.
            </Typography>
          </Box>
          <Chip
            icon={<ChatBubbleOutlineRoundedIcon />}
            label="Titoli + chat"
            color="primary"
            variant="outlined"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}
          />
        </Stack>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mt: 2.5, mb: 1.25 }}
      >
        <Box>
          <Typography component="h2" variant="h2">
            Conversazioni
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {debouncedSearch
              ? `${filteredSessions.length} ${filteredSessions.length === 1 ? "risultato" : "risultati"} per “${debouncedSearch}”`
              : providerFilter === "all"
                ? `${filteredSessions.length} sessioni nel workspace`
                : `${filteredSessions.length} sessioni ${agentsById.get(providerFilter)?.label ?? providerFilter}`}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          icon={<SortRoundedIcon />}
          label="Più recenti prima"
        />
      </Stack>

      {isLoading ? (
        <Box
          sx={{
            minHeight: 280,
            display: "grid",
            placeItems: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "background.paper"
          }}
        >
          <Stack alignItems="center" spacing={1.25}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Cerco gli storici locali…
            </Typography>
          </Stack>
        </Box>
      ) : filteredSessions.length > 0 ? (
        <Stack
          component="ul"
          aria-label="Sessioni agent"
          spacing={1}
          sx={{ m: 0, p: 0, listStyle: "none" }}
        >
          {filteredSessions.map((session) => {
            const agent = agentsById.get(session.provider);
            const sessionKey = `${session.provider}:${session.id}`;

            return (
              <AgentSessionRow
                key={sessionKey}
                session={session}
                agent={agent}
                resuming={resumingSessionKey === sessionKey}
                searchTerm={debouncedSearch}
                onResume={() => void handleResume(session)}
              />
            );
          })}
        </Stack>
      ) : (
        <EmptySessions filtered={Boolean(search || providerFilter !== "all")} />
      )}

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        Gli storici vengono letti solo in locale. La ricerca restituisce alla UI esclusivamente un breve frammento,
        mai il transcript completo.
      </Typography>

      <Snackbar
        open={notice !== null}
        autoHideDuration={notice?.severity === "success" ? 4500 : 9000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {notice ? (
          <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

type AgentStatusCardProps = {
  agent: AgentInstallation;
  active: boolean;
  loading: boolean;
  onSelect: () => void;
};

function AgentStatusCard({ agent, active, loading, onSelect }: AgentStatusCardProps) {
  const tone = PROVIDER_TONES[agent.id];
  const status = getAgentStatus(agent);

  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Filtra per ${agent.label}: ${status.label}`}
      sx={(theme) => ({
        minWidth: 0,
        minHeight: 92,
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr)",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        textAlign: "left",
        border: "1px solid",
        borderColor: active ? `${tone}.main` : "divider",
        borderRadius: 1,
        bgcolor: active ? alpha(theme.palette[tone].main, 0.09) : "background.paper",
        transition: "border-color 160ms ease, background-color 160ms ease",
        "&:hover": {
          borderColor: `${tone}.main`,
          bgcolor: alpha(theme.palette[tone].main, 0.07)
        },
        "&:focus-visible": {
          outline: `3px solid ${alpha(theme.palette[tone].main, 0.22)}`,
          outlineOffset: 2
        }
      })}
    >
      <Box
        sx={(theme) => ({
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          borderRadius: 1,
          color: `${tone}.main`,
          bgcolor: alpha(theme.palette[tone].main, 0.11)
        })}
      >
        {loading ? <CircularProgress size={19} color="inherit" /> : getProviderIcon(agent.id)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
          {agent.label}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.35 }}>
          {status.positive ? <CheckCircleRoundedIcon color="success" sx={{ fontSize: 15 }} /> : null}
          <Typography variant="caption" color="text.secondary" noWrap>
            {loading ? "Rilevamento…" : status.label}
          </Typography>
        </Stack>
      </Box>
    </ButtonBase>
  );
}

type AgentSessionRowProps = {
  session: AgentSessionSummary;
  agent: AgentInstallation | undefined;
  resuming: boolean;
  searchTerm: string;
  onResume: () => void;
};

function AgentSessionRow({ session, agent, resuming, searchTerm, onResume }: AgentSessionRowProps) {
  const tone = PROVIDER_TONES[session.provider];
  const updatedAt = session.updatedAt ?? session.startedAt;

  return (
    <Box
      component="li"
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: { xs: "36px minmax(0, 1fr)", md: "36px minmax(0, 1fr) auto" },
        columnGap: 1.25,
        rowGap: 1.25,
        alignItems: "center",
        p: { xs: 1.25, sm: 1.5 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        transition: "border-color 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: alpha(theme.palette[tone].main, 0.52),
          transform: "translateY(-1px)"
        }
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          alignSelf: "start",
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          borderRadius: 1,
          color: `${tone}.main`,
          bgcolor: alpha(theme.palette[tone].main, 0.1),
          "& svg": { fontSize: 19 }
        })}
      >
        {getProviderIcon(session.provider)}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          spacing={0.65}
          sx={{ mb: 0.35 }}
        >
          <Chip size="small" color={tone} variant="outlined" label={session.providerLabel} />
          <Chip size="small" variant="outlined" label={session.projectName} />
          {session.branch ? (
            <Chip size="small" variant="outlined" icon={<CodeRoundedIcon />} label={session.branch} />
          ) : null}
          {updatedAt ? (
            <Typography variant="caption" color="text.secondary" title={formatExactDate(updatedAt)}>
              {formatRelativeDate(updatedAt)}
            </Typography>
          ) : null}
          {session.match?.field === "title" ? (
            <Chip size="small" color="success" variant="outlined" label="Nel titolo" />
          ) : null}
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.4 }}>
          {session.match?.field === "title"
            ? <HighlightedText text={session.title} searchTerm={searchTerm} />
            : session.title}
        </Typography>
        {session.match?.field === "content" ? (
          <Box
            sx={(theme) => ({
              mt: 0.75,
              px: 1,
              py: 0.75,
              borderLeft: "3px solid",
              borderColor: "primary.main",
              borderRadius: "0 6px 6px 0",
              bgcolor: alpha(theme.palette.primary.main, 0.06)
            })}
          >
            <Typography
              variant="caption"
              color="primary.main"
              component="p"
              sx={{ m: 0, mb: 0.2, fontWeight: 800 }}
            >
              Nella chat
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ m: 0, lineHeight: 1.55 }}
            >
              <HighlightedText text={session.match.snippet} searchTerm={searchTerm} />
            </Typography>
          </Box>
        ) : session.preview && session.preview !== session.title ? (
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{
              mt: 0.35,
              mb: 0,
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2
            }}
          >
            {session.preview}
          </Typography>
        ) : null}
      </Box>

      <Button
        variant="contained"
        size="small"
        startIcon={resuming ? <CircularProgress size={15} color="inherit" /> : <TerminalRoundedIcon />}
        onClick={onResume}
        disabled={resuming || !agent?.installed}
        title={agent?.installed ? "Apri un terminale e riprendi questa sessione" : `${session.providerLabel} non installato`}
        sx={{
          gridColumn: { xs: "1 / -1", md: "auto" },
          justifySelf: { xs: "stretch", md: "end" },
          minWidth: 112
        }}
      >
        {resuming ? "Apertura…" : "Riprendi"}
      </Button>
    </Box>
  );
}

function HighlightedText({ text, searchTerm }: { text: string; searchTerm: string }) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("it");
  const matchIndex = text.toLocaleLowerCase("it").indexOf(normalizedSearch);

  if (!normalizedSearch || matchIndex === -1) {
    return text;
  }

  const matchEnd = matchIndex + normalizedSearch.length;

  return (
    <>
      {text.slice(0, matchIndex)}
      <Box
        component="mark"
        sx={(theme) => ({
          px: 0.2,
          color: "inherit",
          bgcolor: alpha(theme.palette.warning.main, 0.34),
          borderRadius: 0.4
        })}
      >
        {text.slice(matchIndex, matchEnd)}
      </Box>
      {text.slice(matchEnd)}
    </>
  );
}

function EmptySessions({ filtered }: { filtered: boolean }) {
  return (
    <Box
      sx={{
        minHeight: 260,
        display: "grid",
        placeItems: "center",
        px: 2,
        textAlign: "center",
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper"
      }}
    >
      <Box>
        <TerminalRoundedIcon color="disabled" sx={{ fontSize: 34 }} />
        <Typography variant="h2" sx={{ mt: 1 }}>
          {filtered ? "Nessuna sessione corrispondente" : "Nessuno storico rilevato"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 460 }}>
          {filtered
            ? "Prova a rimuovere il filtro o a cambiare la ricerca."
            : "Avvia Codex, Claude Code o Gemini CLI in uno dei repository e poi ripeti la rilevazione."}
        </Typography>
      </Box>
    </Box>
  );
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value.trim()), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function getAgentStatus(agent: AgentInstallation): { label: string; positive: boolean } {
  if (agent.installed && agent.used) {
    return {
      label: `Installato · ${agent.sessionCount} ${agent.sessionCount === 1 ? "sessione" : "sessioni"}`,
      positive: true
    };
  }

  if (agent.installed) {
    return { label: "Installato · nessuno storico", positive: true };
  }

  if (agent.used) {
    return { label: `Storico trovato · CLI non disponibile`, positive: false };
  }

  return { label: "Non rilevato", positive: false };
}

function getProviderIcon(provider: AgentSessionProvider) {
  if (provider === "claude") return <PsychologyOutlinedIcon />;
  if (provider === "gemini") return <AutoAwesomeOutlinedIcon />;
  return <TerminalRoundedIcon />;
}

function formatRelativeDate(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Data sconosciuta";
  }

  const elapsedMs = timestamp - Date.now();
  const elapsedMinutes = Math.round(elapsedMs / (60 * 1000));

  if (Math.abs(elapsedMinutes) < 60) {
    return new Intl.RelativeTimeFormat("it", { numeric: "auto" }).format(elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);

  if (Math.abs(elapsedHours) < 24) {
    return new Intl.RelativeTimeFormat("it", { numeric: "auto" }).format(elapsedHours, "hour");
  }

  const elapsedDays = Math.round(elapsedHours / 24);

  if (Math.abs(elapsedDays) < 30) {
    return new Intl.RelativeTimeFormat("it", { numeric: "auto" }).format(elapsedDays, "day");
  }

  return formatExactDate(value);
}

function formatExactDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(timestamp)
    : value;
}

function compareSessionsByRecentUse(left: AgentSessionSummary, right: AgentSessionSummary): number {
  return getSessionTimestamp(right) - getSessionTimestamp(left);
}

function dedupeSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  const sessionsByResumeTarget = new Map<string, AgentSessionSummary>();

  for (const session of sessions) {
    const key = `${session.provider}:${session.projectId}:${session.id}`;
    const current = sessionsByResumeTarget.get(key);

    if (!current || compareSessionsByRecentUse(session, current) < 0) {
      sessionsByResumeTarget.set(key, session);
    }
  }

  return [...sessionsByResumeTarget.values()];
}

function getSessionTimestamp(session: AgentSessionSummary): number {
  const timestamp = Date.parse(session.updatedAt ?? session.startedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}
