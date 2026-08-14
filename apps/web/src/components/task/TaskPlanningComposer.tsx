import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormHelperText,
  FormLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  alpha
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { cancelBrainTaskPlanning, createBrainTaskFromPlan, planBrainTask } from "../../api/brain";
import type { BrainTask, BrainTaskProfile, TaskPlanDraft } from "../../types/brain";
import type { ProjectSummary } from "../../types/projects";
import { MAX_CONTEXT_REPOSITORIES, TASK_PROFILE_LABELS } from "./taskEngineeringConfig";
import { getTaskErrorMessage } from "./taskEngineeringUtils";
import { TaskPlanReview } from "./TaskPlanReview";

type TaskPlanningComposerProps = {
  projectId: string;
  projects: ProjectSummary[];
  canCancel: boolean;
  onStageChange: (stage: "intent" | "planning" | "review") => void;
  onCancel: () => void;
  onCreated: (task: BrainTask) => Promise<void>;
};

export function TaskPlanningComposer({
  projectId,
  projects,
  canCancel,
  onStageChange,
  onCancel,
  onCreated
}: TaskPlanningComposerProps) {
  const [brief, setBrief] = React.useState("");
  const [profile, setProfile] = React.useState<BrainTaskProfile | "auto">("auto");
  const [contextProjectIds, setContextProjectIds] = React.useState<string[]>([]);
  const [draft, setDraft] = React.useState<TaskPlanDraft | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const planningAbortController = React.useRef<AbortController | null>(null);
  const planningRequestId = React.useRef<string | null>(null);
  const primaryProject = projects.find((project) => project.id === projectId);
  const contextProjects = projects.filter((project) => project.id !== projectId);
  const selectedContextProjects = contextProjects.filter((project) => contextProjectIds.includes(project.id));

  React.useEffect(() => () => {
    planningAbortController.current?.abort();
    if (planningRequestId.current) {
      void cancelBrainTaskPlanning(projectId, planningRequestId.current).catch(() => undefined);
    }
  }, [projectId]);

  const planMutation = useMutation({
    mutationFn: () => {
      const abortController = new AbortController();
      const requestId = crypto.randomUUID();
      planningAbortController.current = abortController;
      planningRequestId.current = requestId;

      return planBrainTask(projectId, {
        requestId,
        brief,
        profile,
        contextProjectIds,
        feedback: feedback.trim() || undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
        currentDraft: draft ?? undefined
      }, abortController.signal);
    },
    onSuccess: (nextDraft) => {
      setError(null);
      setDraft(nextDraft);
      setAnswers((currentAnswers) => Object.fromEntries(
        nextDraft.questions
          .filter((question) => question.options.includes(currentAnswers[question.id]))
          .map((question) => [question.id, currentAnswers[question.id]])
      ));
      setFeedback("");
    },
    onError: (mutationError) => {
      if (!isAbortError(mutationError)) setError(getTaskErrorMessage(mutationError));
    },
    onSettled: () => {
      planningAbortController.current = null;
      planningRequestId.current = null;
    }
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Piano non disponibile");

      return createBrainTaskFromPlan(projectId, {
        title: draft.title,
        type: draft.type,
        profile: draft.profile,
        brief,
        description: draft.description,
        motivation: draft.motivation,
        requirements: draft.requirements,
        design: draft.design,
        breakdown: draft.breakdown,
        checks: draft.checks,
        assumptions: draft.assumptions,
        provider: draft.provider,
        generatedAt: draft.generatedAt,
        sessionId: draft.sessionId,
        contextProjectIds,
        clarifications: draft.questions
          .filter((question) => Boolean(answers[question.id]))
          .map((question) => ({ question: question.question, answer: answers[question.id] ?? "" }))
      });
    },
    onSuccess: onCreated,
    onError: (mutationError) => setError(getTaskErrorMessage(mutationError))
  });

  const busy = planMutation.isPending || createMutation.isPending;

  React.useEffect(() => {
    onStageChange(draft ? "review" : planMutation.isPending ? "planning" : "intent");
  }, [draft, onStageChange, planMutation.isPending]);

  function cancelPlanning(): void {
    const requestId = planningRequestId.current;
    planningAbortController.current?.abort();
    planningAbortController.current = null;
    planningRequestId.current = null;
    if (requestId) {
      void cancelBrainTaskPlanning(projectId, requestId).catch(() => undefined);
    }
    planMutation.reset();
  }

  if (draft) {
    return (
      <TaskPlanReview
        draft={draft}
        answers={answers}
        feedback={feedback}
        busy={busy}
        planning={planMutation.isPending}
        creating={createMutation.isPending}
        error={error}
        onDraftChange={setDraft}
        onAnswerChange={(questionId, answer) => {
          setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: answer }));
        }}
        onFeedbackChange={setFeedback}
        onRefine={() => planMutation.mutate()}
        onApprove={() => createMutation.mutate()}
        onBack={() => {
          cancelPlanning();
          setDraft(null);
          setAnswers({});
          setFeedback("");
          setError(null);
        }}
      />
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", minHeight: 520 }}>
      <Box
        sx={{
          px: { xs: 2, md: 3.5 },
          py: { xs: 2.5, md: 3.5 },
          bgcolor: "var(--rc-surface-1)",
          borderLeft: "3px solid",
          borderColor: "primary.main"
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "flex-start" }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                color: "primary.main",
                border: "1px solid",
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.28),
                flexShrink: 0
              }}
            >
              <PsychologyOutlinedIcon />
            </Box>
            <Box>
              <Typography component="h2" variant="h2">Racconta il risultato, al piano pensa Claude</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.6, maxWidth: 720 }}>
                Parti da una richiesta libera. Claude esplora il repository in sola lettura, individua le aree coinvolte e prepara una bozza completa da approvare.
              </Typography>
            </Box>
          </Stack>
          <Chip icon={<AutoAwesomeOutlinedIcon />} color="primary" variant="outlined" label="Claude Code · sola lettura" />
        </Stack>
      </Box>

      <Stack spacing={2.5} sx={{ p: { xs: 2, md: 3.5 } }}>
        {error ? <Alert severity="error" aria-live="polite">{error}</Alert> : null}

        <TextField
          autoFocus
          label="Cosa vuoi cambiare o ottenere?"
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          multiline
          minRows={7}
          fullWidth
          placeholder="Esempio: quando un run fallisce, voglio poterlo rilanciare mantenendo il contesto e vedere chiaramente quale verifica non è passata."
          helperText="Puoi incollare una richiesta, un bug report o descrivere il risultato con parole tue. Non serve preparare requisiti o piano."
          disabled={busy}
        />

        <Accordion variant="outlined" disableGutters sx={{ "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Contesto e preferenze</Typography>
              <Chip size="small" color="primary" label={primaryProject?.name ?? projectId} />
              <Chip
                size="small"
                variant="outlined"
                label={profile === "auto" ? "Profilo automatico" : TASK_PROFILE_LABELS[profile]}
              />
              {contextProjectIds.length > 0 ? (
                <Chip size="small" variant="outlined" label={`+${contextProjectIds.length} repository`} />
              ) : null}
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <FormControl size="small" sx={{ maxWidth: 360 }}>
                <FormLabel id="planning-profile-label" sx={{ mb: 0.75 }}>Profondità del piano</FormLabel>
                <Select
                  aria-labelledby="planning-profile-label"
                  value={profile}
                  onChange={(event) => setProfile(event.target.value as BrainTaskProfile | "auto")}
                >
                  <MenuItem value="auto">Automatica · consigliata</MenuItem>
                  {Object.entries(TASK_PROFILE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Fix e chore restano rapidi; feature e refactor ricevono più dettaglio.</FormHelperText>
              </FormControl>

              <Autocomplete
                multiple
                disableCloseOnSelect
                limitTags={3}
                options={contextProjects}
                value={selectedContextProjects}
                getOptionLabel={(project) => project.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionDisabled={(project) =>
                  contextProjectIds.length >= MAX_CONTEXT_REPOSITORIES && !contextProjectIds.includes(project.id)
                }
                onChange={(_, nextProjects) => setContextProjectIds(nextProjects.map((project) => project.id))}
                renderOption={(props, project, { selected }) => (
                  <li {...props}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                    <ListItemText
                      primary={project.name}
                      secondary={`${project.branch} · ${project.isClean ? "Pulito" : "Modificato"}`}
                    />
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Repository aggiuntivi di contesto"
                    helperText="Verranno letti per capire le dipendenze, senza essere modificati."
                  />
                )}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {planMutation.isPending ? (
          <Paper variant="outlined" sx={{ p: 2.25, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.035) }} aria-live="polite">
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AutoAwesomeOutlinedIcon color="primary" />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Analisi in sola lettura</Typography>
                  <Typography variant="caption" color="text.secondary">Claude sta raccogliendo contesto. Nessuna fase viene segnata come completata prima della review.</Typography>
                </Box>
              </Stack>
              <LinearProgress />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                {["Struttura del repository", "Aree e rischi", "Passi e verifiche"].map((label, index) => (
                  <Stack key={label} direction="row" spacing={0.6} alignItems="center" sx={{ flex: 1 }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid",
                        borderColor: "divider",
                        color: "text.secondary",
                        fontFamily: "var(--rc-font-mono)",
                        fontSize: 10,
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Paper>
        ) : null}

        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
          {canCancel || planMutation.isPending ? (
            <Button
              onClick={() => {
                cancelPlanning();
                onCancel();
              }}
              disabled={createMutation.isPending}
            >
              {planMutation.isPending ? "Interrompi analisi" : "Annulla"}
            </Button>
          ) : <Box />}
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => planMutation.mutate()}
            disabled={busy || brief.trim().length < 8}
          >
            Analizza e prepara il piano
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
