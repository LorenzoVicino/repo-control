import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { fetchAgentStatus } from "../../api/agent";
import { MONO_FONT_FAMILY } from "../../theme";
import type { ProjectSummary } from "../../types/projects";
import { AgentComposer } from "./AgentComposer";
import { AgentMarkdown } from "./AgentMarkdown";
import { ApprovalCard } from "./ApprovalCard";
import { conversationStore as defaultStore, type ConversationStore, type ConversationTurn } from "./conversationStore";
import { accentGradient, glassSurface, orbGradient, visuallyHidden } from "./glass";
import { buildSuggestions } from "./suggestions";
import { ToolActivityGroup } from "./ToolActivityGroup";
import { buildTurnView, type TurnView } from "./turnView";

type AssistantPageProps = {
  projects: readonly ProjectSummary[];
  workspaceRoot: string;
  store?: ConversationStore;
};

const TONE_COLORS = { primary: "primary.main", info: "info.main", warning: "warning.main", success: "success.main" } as const;

/** The last two folders of the workspace path; the full path goes in the tooltip. */
function shortPath(root: string): string {
  const parts = root.split(/[\\/]/).filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : root;
}

// Soft colour behind the glass. Every gradient fades to transparent inside its own box and
// every box stays inside the section, so nothing is clipped into a hard edge or widens the page.
function Glow() {
  return (
    <Box aria-hidden sx={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}>
      <Box sx={(theme) => ({ position: "absolute", top: 0, left: "16%", width: "64%", height: "70%", background: `radial-gradient(closest-side, ${alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.2 : 0.32)}, transparent)` })} />
      <Box sx={(theme) => ({ position: "absolute", bottom: 0, right: 0, width: "52%", height: "62%", background: `radial-gradient(closest-side, ${alpha(theme.palette.info.main, theme.palette.mode === "light" ? 0.16 : 0.24)}, transparent)` })} />
      <Box sx={(theme) => ({ position: "absolute", top: "36%", left: 0, width: "36%", height: "50%", background: `radial-gradient(closest-side, ${alpha("#ec4899", theme.palette.mode === "light" ? 0.09 : 0.14)}, transparent)` })} />
    </Box>
  );
}

function greetingKey(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function AssistantPage({ projects, workspaceRoot, store = defaultStore }: AssistantPageProps) {
  const { t } = useTranslation();
  const conversation = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
  const status = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => fetchAgentStatus(t("assistant.errors.status")),
    staleTime: 60_000,
    retry: false
  });
  const [actionError, setActionError] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const refreshedTurns = React.useRef(new Set<string>());
  const available = status.data?.available ?? false;
  const unavailable = status.isError || (status.isSuccess && !available);
  const turnViews = React.useMemo(() => conversation.turns.map((turn) => ({ turn, view: buildTurnView(turn.events) })), [conversation.turns]);
  const repositories = [...new Set(turnViews.flatMap(({ view }) => view.repositories))];

  // Follow the conversation like a chat: while the reader is at the bottom, new content keeps
  // them there, so the sticky composer never covers the latest answer or an approval card.
  // Scrolling up to reread stops the following until they return to the bottom.
  const following = React.useRef(true);
  React.useEffect(() => {
    const update = () => {
      following.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const contentSize = conversation.turns.reduce((total, turn) => total + turn.events.length + (turn.error ? 1 : 0), conversation.turns.length);
  React.useEffect(() => {
    if (!contentSize || !following.current) return;
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [contentSize]);

  // A finished turn that carried out an approved change has altered the workspace: rescan, so
  // the rest of the dashboard and the next suggestions reflect it.
  React.useEffect(() => {
    for (const { turn, view } of turnViews) {
      const changed = view.blocks.some((block) => block.kind === "approval" && block.state === "allowed");
      if (view.status !== "running" && changed && !refreshedTurns.current.has(turn.id)) {
        refreshedTurns.current.add(turn.id);
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    }
  }, [turnViews, queryClient]);

  const messages = {
    startFailed: t("assistant.errors.startFailed"),
    streamLost: t("assistant.errors.streamLost"),
    decisionFailed: t("assistant.errors.decisionFailed"),
    cancelFailed: t("assistant.errors.cancelFailed")
  };
  const send = (prompt: string) => {
    setActionError(null);
    void store.send(prompt, messages);
  };
  const stop = () => {
    store.stop(messages.cancelFailed).catch((error: unknown) => setActionError(error instanceof Error ? error.message : messages.cancelFailed));
  };

  const header = (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
      <Box title={workspaceRoot} sx={(theme) => ({ ...glassSurface(theme), height: 36, px: 1.75, borderRadius: 999, display: "flex", alignItems: "center", gap: 1, fontSize: "0.82rem", minWidth: 0, maxWidth: "100%" })}>
        <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: "success.main", flex: "none" }} />
        <Box component="span" sx={{ fontFamily: MONO_FONT_FAMILY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortPath(workspaceRoot)}</Box>
        <Box component="span" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{t("assistant.repositoryCount", { count: projects.length })}</Box>
      </Box>
      <Box sx={(theme) => ({ ...glassSurface(theme), ml: "auto !important", height: 36, px: 1.75, borderRadius: 999, display: "flex", alignItems: "center", fontFamily: MONO_FONT_FAMILY, fontSize: "0.76rem", color: "text.secondary" })}>
        {t("assistant.engine")}
        {status.data?.model ? ` · ${status.data.model}` : ""}
      </Box>
      {conversation.turns.length ? (
        <Button
          size="small"
          color="inherit"
          startIcon={<AddCommentOutlinedIcon fontSize="small" />}
          disabled={conversation.busy}
          onClick={() => store.reset()}
          sx={(theme) => ({ ...glassSurface(theme), height: 36, px: 1.75, borderRadius: 999 })}
        >
          {t("assistant.newConversation")}
        </Button>
      ) : null}
    </Stack>
  );

  const unavailableNotice = unavailable ? (
    <Alert severity="info" variant="outlined" sx={(theme) => ({ ...glassSurface(theme), borderRadius: 2.5, width: "100%", boxSizing: "border-box" })}>
      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{t("assistant.unavailable.title")}</Typography>
      <Typography sx={{ fontSize: "0.88rem" }}>{import.meta.env.MODE === "demo" ? t("assistant.unavailable.demo") : t("assistant.unavailable.body")}</Typography>
    </Alert>
  ) : null;

  if (!conversation.turns.length) {
    const suggestions = buildSuggestions(projects, t);
    return (
      <Box component="section" aria-labelledby="assistant-title" sx={{ position: "relative", isolation: "isolate", display: "flex", flexDirection: "column", gap: 3.5 }}>
        <Glow />
        {header}
        <Stack spacing={2.75} sx={{ width: "100%", maxWidth: 900, mx: "auto", mt: { xs: 1, md: 3 }, alignItems: "center" }}>
          <Box aria-hidden sx={(theme) => ({ width: 64, height: 64, borderRadius: 999, background: orbGradient(theme), boxShadow: `0 0 60px ${alpha(theme.palette.primary.main, 0.45)}, 0 0 120px ${alpha(theme.palette.info.main, 0.25)}` })} />
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.95rem" }}>{t(`assistant.greeting.${greetingKey(new Date().getHours())}`)}</Typography>
            <Typography id="assistant-title" component="h1" sx={{ fontSize: { xs: "1.8rem", md: "2.5rem" }, lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.025em" }}>
              {t("assistant.title")}
            </Typography>
          </Stack>
          {unavailableNotice}
          <AgentComposer
            variant="hero"
            busy={conversation.busy}
            disabled={unavailable || status.isPending}
            onSend={send}
            onStop={stop}
            footer={<Typography sx={{ fontSize: "0.78rem", color: "text.secondary", px: 0.5 }}>{t("assistant.writesNote")}</Typography>}
          />
          <Stack spacing={1.25} sx={{ width: "100%" }}>
            <Typography component="h2" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{t("assistant.suggestionsTitle")}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1.5 }}>
              {suggestions.map((suggestion) => (
                <Box
                  key={suggestion.id}
                  component="button"
                  type="button"
                  disabled={unavailable || conversation.busy}
                  onClick={() => send(suggestion.prompt)}
                  sx={(theme) => ({
                    ...glassSurface(theme),
                    textAlign: "left",
                    p: 1.75,
                    borderRadius: 2.25,
                    color: "text.primary",
                    font: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    transition: "transform 160ms, border-color 160ms",
                    "&:hover:not(:disabled)": { transform: "translateY(-2px)", borderColor: alpha(theme.palette.primary.main, 0.5) },
                    "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                    "&:disabled": { cursor: "default", opacity: 0.55 }
                  })}
                >
                  <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: TONE_COLORS[suggestion.tone], boxShadow: 1 }} />
                  <Typography component="span" sx={{ fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.3 }}>{suggestion.title}</Typography>
                  <Typography component="span" sx={{ fontSize: "0.8rem", lineHeight: 1.45, color: "text.secondary" }}>{suggestion.reason}</Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        </Stack>
      </Box>
    );
  }

  const latestSession = conversation.sessionId;

  return (
    <Box component="section" aria-label={t("navigation.sections.assistant")} sx={{ position: "relative", isolation: "isolate", display: "flex", flexDirection: "column", gap: 2.25 }}>
      <Glow />
      {header}
      <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start" }}>
        <Stack spacing={2.25} sx={{ flex: "999 1 520px", minWidth: 0, maxWidth: 860, mx: "auto" }}>
          <Box role="log" aria-live="polite" aria-relevant="additions" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {turnViews.map(({ turn, view }) => (
              <Turn key={turn.id} turn={turn} view={view} onDecide={(approvalId, behavior) => store.decide(turn.runId ?? "", approvalId, { behavior }, messages.decisionFailed)} />
            ))}
          </Box>
          {actionError ? <Alert severity="error">{actionError}</Alert> : null}
          {unavailableNotice}
          <Box sx={{ position: "sticky", bottom: 16, zIndex: 2 }}>
            <AgentComposer variant="reply" busy={conversation.busy} disabled={unavailable} onSend={send} onStop={stop} />
          </Box>
        </Stack>

        <Box
          component="aside"
          aria-label={t("assistant.context.label")}
          sx={(theme) => ({
            ...glassSurface(theme),
            display: { xs: "none", lg: "flex" },
            flex: "1 1 280px",
            maxWidth: 320,
            position: "sticky",
            top: 16,
            p: 2.25,
            borderRadius: 3,
            flexDirection: "column",
            gap: 2.5
          })}
        >
          <Stack spacing={1}>
            <Typography component="h2" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{t("assistant.context.repositories")}</Typography>
            {repositories.length ? (
              repositories.map((name) => {
                const project = projects.find((candidate) => candidate.name === name);
                return (
                  <Stack key={name} direction="row" spacing={1} sx={{ alignItems: "center", fontSize: "0.8rem" }}>
                    <Box aria-hidden sx={{ width: 7, height: 7, borderRadius: 999, bgcolor: !project ? "text.disabled" : !project.isClean ? "warning.main" : project.behind ? "info.main" : project.ahead ? "primary.main" : "success.main" }} />
                    <Box component="span" sx={{ fontFamily: MONO_FONT_FAMILY }}>{name}</Box>
                  </Stack>
                );
              })
            ) : (
              <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{t("assistant.context.none")}</Typography>
            )}
          </Stack>
          <Stack spacing={1}>
            <Typography component="h2" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>{t("assistant.context.permissions")}</Typography>
            <Permission label={t("assistant.context.readTools")} value={t("assistant.context.automatic")} tone="success" />
            <Permission label={t("assistant.context.writeTools")} value={t("assistant.context.askFirst")} tone="primary" />
            <Permission label={t("assistant.context.shellTools")} value={t("assistant.context.off")} tone="neutral" />
          </Stack>
          {latestSession && import.meta.env.MODE !== "demo" ? (
            <Box sx={(theme) => ({ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.45), border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`, display: "flex", flexDirection: "column", gap: 0.75 })}>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 600 }}>{t("assistant.context.session")}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: "text.secondary" }}>{t("assistant.context.sessionHint")}</Typography>
              <Box component="code" sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: "0.72rem", wordBreak: "break-all" }}>claude --resume {latestSession}</Box>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function Permission({ label, value, tone }: { label: string; value: string; tone: "success" | "primary" | "neutral" }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", fontSize: "0.8rem" }}>
      <Box component="span" sx={{ color: "text.secondary" }}>{label}</Box>
      <Box
        component="span"
        sx={(theme) => {
          const color = tone === "neutral" ? theme.palette.text.secondary : theme.palette[tone].main;
          return { ml: "auto", px: 1, py: 0.25, borderRadius: 999, fontSize: "0.72rem", bgcolor: alpha(color, 0.14), color: tone === "neutral" ? "text.secondary" : `${tone}.light` };
        }}
      >
        {value}
      </Box>
    </Stack>
  );
}

function Turn({ turn, view, onDecide }: { turn: ConversationTurn; view: TurnView; onDecide: (approvalId: string, behavior: "allow" | "deny") => Promise<void> }) {
  const { t } = useTranslation();
  const running = view.status === "running" && !turn.error;
  const waitingForFirstEvent = running && view.blocks.length === 0;

  return (
    <Stack spacing={2}>
      <Box
        sx={(theme) => ({
          alignSelf: "flex-end",
          maxWidth: "80%",
          px: 2,
          py: 1.5,
          borderRadius: "20px 20px 6px 20px",
          bgcolor: alpha(theme.palette.primary.main, 0.16),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          fontSize: "0.95rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere"
        })}
      >
        <Box component="span" sx={visuallyHidden}>{t("assistant.you")}: </Box>
        {turn.prompt}
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            flex: "none",
            width: 30,
            height: 30,
            borderRadius: 999,
            background: orbGradient(theme),
            boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.4)}`,
            animation: running ? "assistantPulse 1.6s ease-in-out infinite" : "none",
            "@keyframes assistantPulse": { "0%, 100%": { transform: "scale(1)", opacity: 1 }, "50%": { transform: "scale(0.86)", opacity: 0.75 } },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" }
          })}
        />
        <Stack spacing={1.75} sx={{ flex: 1, minWidth: 0 }}>
          <Box component="span" sx={visuallyHidden}>{t("assistant.agent")}:</Box>
          {waitingForFirstEvent ? <TypingDots /> : null}
          {view.blocks.map((block) => {
            switch (block.kind) {
              case "activity":
                return <ToolActivityGroup key={block.key} tools={block.tools} running={running} />;
              case "text":
                return <AgentMarkdown key={block.key} text={block.text} />;
              case "approval":
                return (
                  <ApprovalCard
                    key={block.key}
                    title={block.title}
                    toolName={block.toolName}
                    input={block.input}
                    state={block.state}
                    onDecide={(behavior) => onDecide(block.approvalId, behavior)}
                  />
                );
              case "error":
                return <Alert key={block.key} severity="error" variant="outlined">{block.message}</Alert>;
            }
          })}
          {turn.error ? <Alert severity="warning" variant="outlined">{turn.error}</Alert> : null}
          <TurnFooter view={view} />
        </Stack>
      </Stack>
    </Stack>
  );
}

function TurnFooter({ view }: { view: TurnView }) {
  const { t } = useTranslation();
  if (view.status === "cancelled") return <FooterText>{t("assistant.summary.stopped")}</FooterText>;
  if (view.status === "failed" && !view.blocks.some((block) => block.kind === "error")) return <FooterText>{t("assistant.summary.failed")}</FooterText>;
  if (!view.summary || view.status !== "completed") return null;
  const parts = [
    view.summary.durationMs !== null ? t("assistant.summary.done", { seconds: (view.summary.durationMs / 1000).toFixed(1) }) : null,
    view.summary.turns !== null ? t("assistant.summary.turns", { count: view.summary.turns }) : null,
    view.summary.costUsd !== null ? t("assistant.summary.cost", { cost: view.summary.costUsd.toFixed(4) }) : null
  ].filter(Boolean);
  return <FooterText>{parts.join(" · ")}</FooterText>;
}

function FooterText({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", fontFamily: MONO_FONT_FAMILY }}>{children}</Typography>;
}

function TypingDots() {
  return (
    <Box aria-hidden sx={{ display: "flex", gap: 0.6, py: 1 }}>
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={(theme) => ({
            width: 7,
            height: 7,
            borderRadius: 999,
            background: accentGradient(theme),
            animation: `assistantDot 1.2s ${index * 0.15}s ease-in-out infinite`,
            "@keyframes assistantDot": { "0%, 80%, 100%": { opacity: 0.25 }, "40%": { opacity: 1 } },
            "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.6 }
          })}
        />
      ))}
    </Box>
  );
}
