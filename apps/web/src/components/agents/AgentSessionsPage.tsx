import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
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
import type { AgentInstallation, AgentSessionProvider, AgentSessionSummary } from "../../types/agentSessions";

type ProviderFilter = "all" | AgentSessionProvider;
type Notice = { severity: "success" | "error"; message: string };

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
  const [selectedSessionKey, setSelectedSessionKey] = React.useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 320);
  const [resumingSessionKey, setResumingSessionKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["agent-sessions", debouncedSearch],
    queryFn: () => fetchAgentSessions(debouncedSearch),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000
  });
  const agentsById = React.useMemo(
    () => new Map(data?.agents.map((agent) => [agent.id, agent]) ?? []),
    [data?.agents]
  );
  const filteredSessions = React.useMemo(
    () => dedupeSessions(data?.sessions ?? [])
      .filter((session) => providerFilter === "all" || session.provider === providerFilter)
      .sort(compareSessionsByRecentUse),
    [data?.sessions, providerFilter]
  );
  const totalSessionCount = data?.agents.reduce((total, agent) => total + agent.sessionCount, 0) ?? 0;
  const isSearchPending = search.trim() !== debouncedSearch || (isFetching && Boolean(search.trim()));
  const selectedSession = filteredSessions.find((session) => getSessionKey(session) === selectedSessionKey)
    ?? filteredSessions[0]
    ?? null;

  async function handleResume(session: AgentSessionSummary) {
    const sessionKey = getSessionKey(session);
    setResumingSessionKey(sessionKey);
    setNotice(null);

    try {
      const result = await resumeAgentSession(session.provider, session.id, session.projectId);
      setNotice({ severity: "success", message: result.message });
    } catch (resumeError) {
      setNotice({
        severity: "error",
        message: resumeError instanceof Error ? resumeError.message : "Impossibile aprire la sessione nel terminale"
      });
    } finally {
      setResumingSessionKey(null);
    }
  }

  return (
    <Box component="section" aria-labelledby="agent-sessions-title">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "flex-end" }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ pb: 1.75, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">Storici locali</Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
            <Typography id="agent-sessions-title" component="h1" variant="h1">Agent sessions</Typography>
            {data ? <Chip size="small" variant="outlined" label={totalSessionCount} /> : null}
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.55, maxWidth: 720 }}>
            Cerca e riprendi conversazioni Codex, Claude Code e Gemini CLI nel loro contesto repository.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={isFetching ? <CircularProgress size={14} color="inherit" /> : <RefreshRoundedIcon />}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Rileva di nuovo
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 1.25 }}>
          {error instanceof Error ? error.message : "Impossibile rilevare le sessioni degli agent"}
        </Alert>
      ) : null}
      {data?.warnings.length ? (
        <Alert severity="warning" sx={{ mt: 1.25 }}>
          Rilevazione parziale: {data.warnings.join(" · ")}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "188px minmax(360px, 1fr) 340px" },
          gap: 1,
          mt: 1.5,
          alignItems: "start"
        }}
      >
        <Box
          aria-label="Agent rilevati"
          sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: "var(--rc-radius-panel)", bgcolor: "background.paper" }}
        >
          <PanelTitle label="Provider" meta={`${data?.agents.filter((agent) => agent.installed).length ?? 0}/3`} />
          <Stack sx={{ p: 0.75 }} spacing={0.5}>
            {(data?.agents ?? AGENT_PLACEHOLDERS).map((agent) => (
              <AgentStatusCard
                key={agent.id}
                agent={agent}
                active={providerFilter === agent.id}
                loading={isLoading}
                onSelect={() => setProviderFilter((current) => current === agent.id ? "all" : agent.id)}
              />
            ))}
          </Stack>
          {providerFilter !== "all" ? (
            <Button size="small" variant="text" fullWidth onClick={() => setProviderFilter("all")} sx={{ borderTop: "1px solid", borderColor: "divider", borderRadius: 0 }}>
              Mostra tutti
            </Button>
          ) : null}
        </Box>

        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Box component="search" aria-label="Ricerca nelle conversazioni degli agent">
            <TextField
              fullWidth
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca nei titoli e nel contenuto delle chat…"
              inputProps={{ "aria-label": "Cerca nei titoli e nel contenuto delle chat", maxLength: 200 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 17 }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    {isSearchPending ? <CircularProgress size={16} aria-label="Ricerca in corso" /> : search ? (
                      <IconButton size="small" aria-label="Cancella ricerca" onClick={() => setSearch("")} edge="end">
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                )
              }}
              sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
            />
          </Box>

          <Box sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: "var(--rc-radius-panel)", bgcolor: "background.paper" }}>
            <PanelTitle
              label="Conversazioni"
              meta={debouncedSearch ? `${filteredSessions.length} risultati per “${debouncedSearch}”` : `${filteredSessions.length} · più recenti`}
              icon={<SortRoundedIcon sx={{ fontSize: 14 }} />}
            />
            {isLoading ? (
              <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}>
                <Stack alignItems="center" spacing={1}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">Cerco gli storici locali…</Typography>
                </Stack>
              </Box>
            ) : filteredSessions.length > 0 ? (
              <Stack component="ul" aria-label="Sessioni agent" sx={{ m: 0, p: 0, listStyle: "none" }}>
                {filteredSessions.map((session) => {
                  const sessionKey = getSessionKey(session);
                  return (
                    <AgentSessionRow
                      key={sessionKey}
                      session={session}
                      agent={agentsById.get(session.provider)}
                      selected={sessionKey === getSessionKey(selectedSession)}
                      resuming={resumingSessionKey === sessionKey}
                      searchTerm={debouncedSearch}
                      onSelect={() => setSelectedSessionKey(sessionKey)}
                      onResume={() => void handleResume(session)}
                    />
                  );
                })}
              </Stack>
            ) : <EmptySessions filtered={Boolean(search || providerFilter !== "all")} />}
          </Box>
        </Stack>

        <AgentSessionDetail
          session={selectedSession}
          agent={selectedSession ? agentsById.get(selectedSession.provider) : undefined}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.25 }}>
        Lettura esclusivamente locale: la UI riceve solo metadati e il breve frammento corrispondente, mai il transcript completo.
      </Typography>

      <Snackbar
        open={notice !== null}
        autoHideDuration={notice?.severity === "success" ? 4500 : 9000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {notice ? <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>{notice.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function PanelTitle({ label, meta, icon }: { label: string; meta: string; icon?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.65} sx={{ minHeight: 38, px: 1.25, bgcolor: "var(--rc-surface-2)", borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography component="h2" variant="h2" sx={{ flexGrow: 1 }}>{label}</Typography>
      {icon}
      <Typography color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>{meta}</Typography>
    </Stack>
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
        minHeight: 52,
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1fr)",
        alignItems: "center",
        gap: 0.8,
        px: 0.8,
        py: 0.6,
        textAlign: "left",
        borderRadius: "var(--rc-radius-control)",
        bgcolor: active ? alpha(theme.palette[tone].main, 0.1) : "transparent",
        boxShadow: active ? `inset 2px 0 ${theme.palette[tone].main}` : "none",
        "&:hover": { bgcolor: "var(--rc-surface-2)" }
      })}
    >
      <Box sx={{ width: 28, height: 28, display: "grid", placeItems: "center", color: `${tone}.main`, "& svg": { fontSize: 17 } }}>
        {loading ? <CircularProgress size={16} color="inherit" /> : getProviderIcon(agent.id)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" noWrap component="div" sx={{ fontWeight: 500 }}>{agent.label}</Typography>
        <Stack direction="row" alignItems="center" spacing={0.4}>
          {status.positive ? <CheckCircleRoundedIcon color="success" sx={{ fontSize: 11 }} /> : null}
          <Typography noWrap color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 8.75 }}>
            {loading ? "rilevamento…" : status.label}
          </Typography>
        </Stack>
      </Box>
    </ButtonBase>
  );
}

type AgentSessionRowProps = {
  session: AgentSessionSummary;
  agent: AgentInstallation | undefined;
  selected: boolean;
  resuming: boolean;
  searchTerm: string;
  onSelect: () => void;
  onResume: () => void;
};

function AgentSessionRow({ session, agent, selected, resuming, searchTerm, onSelect, onResume }: AgentSessionRowProps) {
  const tone = PROVIDER_TONES[session.provider];
  const updatedAt = session.updatedAt ?? session.startedAt;

  return (
    <Box
      component="li"
      sx={(theme) => ({
        position: "relative",
        display: "grid",
        gridTemplateColumns: { xs: "30px minmax(0, 1fr)", md: "30px minmax(0, 1fr) auto" },
        columnGap: 1,
        rowGap: 0.75,
        alignItems: "center",
        px: 1.25,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.075) : "transparent",
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 9,
          bottom: 9,
          width: 2,
          bgcolor: "primary.main",
          transform: selected ? "scaleY(1)" : "scaleY(0)"
        },
        "&:last-child": { borderBottom: 0 },
        "&:hover": { bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : "action.hover" }
      })}
    >
      <Box aria-hidden="true" sx={{ alignSelf: "start", width: 30, height: 30, display: "grid", placeItems: "center", color: `${tone}.main`, "& svg": { fontSize: 17 } }}>
        {getProviderIcon(session.provider)}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={0.55} sx={{ mb: 0.3 }}>
          <Chip size="small" color={tone} variant="outlined" label={session.providerLabel} />
          <Chip size="small" variant="outlined" label={session.projectName} />
          {session.branch ? <Chip size="small" variant="outlined" icon={<CodeRoundedIcon />} label={session.branch} /> : null}
          {updatedAt ? <Typography variant="caption" color="text.secondary" title={formatExactDate(updatedAt)}>{formatRelativeDate(updatedAt)}</Typography> : null}
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.4 }}>
          {session.match?.field === "title" ? <HighlightedText text={session.title} searchTerm={searchTerm} /> : session.title}
        </Typography>
        {session.match?.field === "content" ? (
          <Box sx={{ mt: 0.65, pl: 0.9, borderLeft: "2px solid", borderColor: "primary.main" }}>
            <Typography variant="caption" color="primary.light" component="p" sx={{ m: 0, fontWeight: 500 }}>Nella chat</Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, lineHeight: 1.55 }}>
              <HighlightedText text={session.match.snippet} searchTerm={searchTerm} />
            </Typography>
          </Box>
        ) : session.preview && session.preview !== session.title ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.3, mb: 0, display: "-webkit-box", overflow: "hidden", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>
            {session.preview}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={0.5} sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, justifySelf: { xs: "stretch", md: "end" } }}>
        <Button size="small" variant="text" onClick={onSelect}>Dettagli</Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={resuming ? <CircularProgress size={13} color="inherit" /> : <TerminalRoundedIcon />}
          onClick={onResume}
          disabled={resuming || !agent?.installed}
          title={agent?.installed ? "Apri un terminale e riprendi questa sessione" : `${session.providerLabel} non installato`}
        >
          {resuming ? "Apertura…" : "Riprendi"}
        </Button>
      </Stack>
    </Box>
  );
}

function AgentSessionDetail({ session, agent }: { session: AgentSessionSummary | null; agent: AgentInstallation | undefined }) {
  return (
    <Box sx={{ position: { lg: "sticky" }, top: { lg: 64 }, overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: "var(--rc-radius-panel)", bgcolor: "background.paper" }}>
      <PanelTitle label="Contesto sessione" meta={session?.providerLabel ?? "—"} />
      {session ? (
        <Stack spacing={1.4} sx={{ p: 1.5 }}>
          <Box>
            <Typography variant="overline" color="text.secondary">Repository</Typography>
            <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 500 }}>{session.projectName}</Typography>
            <Typography
              color="text.secondary"
              title={session.projectPath}
              sx={{ mt: 0.2, direction: "rtl", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}
            >
              {session.projectPath}
            </Typography>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <DetailField label="Branch" value={session.branch ?? "non rilevato"} mono />
            <DetailField label="Aggiornata" value={session.updatedAt ? formatRelativeDate(session.updatedAt) : "sconosciuta"} />
          </Box>
          <Box sx={{ px: 1, py: 0.85, borderLeft: "2px solid", borderColor: agent?.installed ? "success.main" : "warning.main", bgcolor: "var(--rc-surface-2)" }}>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {agent?.installed ? `${session.providerLabel} disponibile` : `${session.providerLabel} non installato`}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mt: 0.2 }}>
              La ripresa apre un terminale nel repository indicato e delega la conversazione alla CLI originale.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Il transcript completo resta sul disco locale e non viene caricato in questa vista.
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>Seleziona una sessione per ispezionarne il contesto.</Typography>
      )}
    </Box>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
      <Typography noWrap component="div" sx={{ mt: 0.25, fontFamily: mono ? "var(--rc-font-mono)" : undefined, fontSize: mono ? 10 : 11.5 }}>{value}</Typography>
    </Box>
  );
}

function HighlightedText({ text, searchTerm }: { text: string; searchTerm: string }) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("it");
  const matchIndex = text.toLocaleLowerCase("it").indexOf(normalizedSearch);
  if (!normalizedSearch || matchIndex === -1) return <>{text}</>;
  const matchEnd = matchIndex + normalizedSearch.length;
  return <>{text.slice(0, matchIndex)}<Box component="mark" sx={{ px: 0.2, color: "inherit", bgcolor: "action.selected", borderRadius: 0.4 }}>{text.slice(matchIndex, matchEnd)}</Box>{text.slice(matchEnd)}</>;
}

function EmptySessions({ filtered }: { filtered: boolean }) {
  return (
    <Box sx={{ minHeight: 240, display: "grid", placeItems: "center", p: 3, textAlign: "center" }}>
      <Box>
        <Typography variant="h2">{filtered ? "Nessuna sessione corrispondente" : "Nessuno storico rilevato"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420 }}>
          {filtered ? "Prova a rimuovere il filtro o a cambiare la ricerca." : "Avvia Codex, Claude Code o Gemini CLI in uno dei repository e poi ripeti la rilevazione."}
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
  if (agent.installed && agent.used) return { label: `${agent.sessionCount} ${agent.sessionCount === 1 ? "sessione" : "sessioni"}`, positive: true };
  if (agent.installed) return { label: "nessuno storico", positive: true };
  if (agent.used) return { label: "CLI non disponibile", positive: false };
  return { label: "non rilevato", positive: false };
}

function getProviderIcon(provider: AgentSessionProvider) {
  if (provider === "claude") return <PsychologyOutlinedIcon />;
  if (provider === "gemini") return <AutoAwesomeOutlinedIcon />;
  return <TerminalRoundedIcon />;
}

function formatRelativeDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Data sconosciuta";
  const elapsedMinutes = Math.round((timestamp - Date.now()) / (60 * 1000));
  if (Math.abs(elapsedMinutes) < 60) return new Intl.RelativeTimeFormat("it", { numeric: "auto" }).format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return new Intl.RelativeTimeFormat("it", { numeric: "auto" }).format(elapsedHours, "hour");
  const elapsedDays = Math.round(elapsedHours / 24);
  if (Math.abs(elapsedDays) < 30) return new Intl.RelativeTimeFormat("it", { numeric: "auto" }).format(elapsedDays, "day");
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
    if (!current || compareSessionsByRecentUse(session, current) < 0) sessionsByResumeTarget.set(key, session);
  }
  return [...sessionsByResumeTarget.values()];
}

function getSessionTimestamp(session: AgentSessionSummary): number {
  const timestamp = Date.parse(session.updatedAt ?? session.startedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSessionKey(session: AgentSessionSummary | null): string {
  return session ? `${session.provider}:${session.id}` : "";
}
