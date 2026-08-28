import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
  alpha
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { BrainTaskProfile, BrainTaskType, TaskPlanDraft } from "../../types/brain";
import {
  getTaskProfileLabel,
  getTaskTypeLabel,
  TASK_PROFILE_IDS,
  TASK_TYPE_IDS
} from "./taskEngineeringConfig";

type TaskPlanReviewProps = {
  draft: TaskPlanDraft;
  answers: Record<string, string>;
  feedback: string;
  busy: boolean;
  planning: boolean;
  creating: boolean;
  error: string | null;
  onDraftChange: (draft: TaskPlanDraft) => void;
  onAnswerChange: (questionId: string, answer: string) => void;
  onFeedbackChange: (feedback: string) => void;
  onRefine: () => void;
  onApprove: () => void;
  onBack: () => void;
};

export function TaskPlanReview({
  draft,
  answers,
  feedback,
  busy,
  planning,
  creating,
  error,
  onDraftChange,
  onAnswerChange,
  onFeedbackChange,
  onRefine,
  onApprove,
  onBack
}: TaskPlanReviewProps) {
  const { t } = useTranslation();
  const allQuestionsAnswered = draft.questions.every((question) => Boolean(answers[question.id]));
  const canApprove = Boolean(
    draft.title.trim()
    && draft.description.trim()
    && draft.requirements.trim()
    && draft.design.trim()
    && draft.breakdown.trim()
    && draft.checks.length > 0
    && allQuestionsAnswered
  );

  function updateDraft(update: Partial<TaskPlanDraft>): void {
    onDraftChange({ ...draft, ...update });
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2.5,
          bgcolor: "var(--rc-surface-1)",
          borderLeft: "3px solid",
          borderColor: "primary.main"
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between">
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.main",
                color: "primary.contrastText",
                flexShrink: 0
              }}
            >
              <AutoAwesomeOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h2">{t("taskEngineering.review.heading")}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t("taskEngineering.review.description")}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="primary"
              label={t("taskEngineering.review.providerChip", { provider: draft.providerLabel })}
            />
            <Chip size="small" variant="outlined" label={getTaskProfileLabel(t, draft.profile)} />
          </Stack>
        </Stack>
      </Box>

      <Stack spacing={2.5} sx={{ p: { xs: 2, md: 3 } }}>
        {error ? <Alert severity="error" aria-live="polite">{error}</Alert> : null}

        {draft.questions.length > 0 ? (
          <Paper
            variant="outlined"
            sx={{ p: 2, borderColor: "warning.light", bgcolor: (theme) => alpha(theme.palette.warning.main, 0.055) }}
          >
            <Typography variant="h3">{t("taskEngineering.review.beforeApproving")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, mb: 2 }}>
              {t("taskEngineering.review.beforeApprovingDescription")}
            </Typography>
            <Stack spacing={2.25}>
              {draft.questions.map((question) => (
                <FormControl key={question.id} required>
                  <FormLabel sx={{ color: "text.primary", fontWeight: 750 }}>{question.question}</FormLabel>
                  <RadioGroup
                    value={answers[question.id] ?? ""}
                    onChange={(event) => onAnswerChange(question.id, event.target.value)}
                    sx={{ mt: 0.75 }}
                  >
                    {question.options.map((option) => (
                      <FormControlLabel
                        key={option}
                        value={option}
                        control={<Radio size="small" />}
                        label={
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography variant="body2">{option}</Typography>
                            {option === question.recommendedOption ? (
                              <Chip size="small" color="primary" variant="outlined" label={t("taskEngineering.review.recommended")} />
                            ) : null}
                          </Stack>
                        }
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              ))}
            </Stack>
          </Paper>
        ) : (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            {t("taskEngineering.review.noQuestions")}
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 300px" }, gap: 2 }}>
          <Paper variant="outlined" sx={{ overflow: "hidden", alignSelf: "start" }}>
          <Stack spacing={0}>
            <Card sx={reviewSectionSx}>
              <CardHeader
                title={t("taskEngineering.review.goalTitle")}
                subheader={t("taskEngineering.review.goalSubtitle")}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label={t("taskEngineering.review.titleLabel")}
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    fullWidth
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <FormControl size="small" fullWidth>
                      <FormLabel id="planned-task-type-label" sx={{ mb: 0.75 }}>
                        {t("taskEngineering.review.typeLabel")}
                      </FormLabel>
                      <Select
                        aria-labelledby="planned-task-type-label"
                        value={draft.type}
                        onChange={(event) => updateDraft({ type: event.target.value as BrainTaskType })}
                      >
                        {TASK_TYPE_IDS.map((typeId) => (
                          <MenuItem key={typeId} value={typeId}>{getTaskTypeLabel(t, typeId)}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                      <FormLabel id="planned-task-profile-label" sx={{ mb: 0.75 }}>
                        {t("taskEngineering.review.profileLabel")}
                      </FormLabel>
                      <Select
                        aria-labelledby="planned-task-profile-label"
                        value={draft.profile}
                        onChange={(event) => updateDraft({ profile: event.target.value as BrainTaskProfile })}
                      >
                        {TASK_PROFILE_IDS.map((profileId) => (
                          <MenuItem key={profileId} value={profileId}>
                            {getTaskProfileLabel(t, profileId)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                  <TextField
                    label={t("taskEngineering.review.problemLabel")}
                    value={draft.description}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    multiline
                    minRows={4}
                    maxRows={8}
                    fullWidth
                  />
                  <TextField
                    label={t("taskEngineering.review.motivationLabel")}
                    value={draft.motivation}
                    onChange={(event) => updateDraft({ motivation: event.target.value })}
                    multiline
                    minRows={2}
                    maxRows={6}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card sx={reviewSectionSx}>
              <CardHeader
                title={t("taskEngineering.review.requirementsTitle")}
                subheader={t("taskEngineering.review.requirementsSubtitle")}
              />
              <CardContent sx={{ pt: 0 }}>
                <TextField
                  value={draft.requirements}
                  onChange={(event) => updateDraft({ requirements: event.target.value })}
                  multiline
                  minRows={10}
                  maxRows={18}
                  fullWidth
                  inputProps={{ "aria-label": t("taskEngineering.review.requirementsTitle") }}
                />
              </CardContent>
            </Card>

            <Card sx={reviewSectionSx}>
              <CardHeader
                title={t("taskEngineering.review.designTitle")}
                subheader={t("taskEngineering.review.designSubtitle")}
              />
              <CardContent sx={{ pt: 0 }}>
                <TextField
                  value={draft.design}
                  onChange={(event) => updateDraft({ design: event.target.value })}
                  multiline
                  minRows={10}
                  maxRows={18}
                  fullWidth
                  inputProps={{ "aria-label": t("taskEngineering.review.designTitle") }}
                />
              </CardContent>
            </Card>

            <Card sx={reviewSectionSx}>
              <CardHeader
                title={t("taskEngineering.review.breakdownTitle")}
                subheader={t("taskEngineering.review.breakdownSubtitle")}
              />
              <CardContent sx={{ pt: 0 }}>
                <TextField
                  value={draft.breakdown}
                  onChange={(event) => updateDraft({ breakdown: event.target.value })}
                  multiline
                  minRows={10}
                  maxRows={18}
                  fullWidth
                  inputProps={{ "aria-label": t("taskEngineering.review.breakdownTitle") }}
                />
              </CardContent>
            </Card>

            <Card sx={reviewSectionSx}>
              <CardHeader
                title={t("taskEngineering.review.checksTitle")}
                subheader={t("taskEngineering.review.checksSubtitle")}
              />
              <CardContent sx={{ pt: 0 }}>
                <TextField
                  value={draft.checks.join("\n")}
                  onChange={(event) => updateDraft({
                    checks: event.target.value.split("\n").map((command) => command.trim()).filter(Boolean)
                  })}
                  multiline
                  minRows={4}
                  maxRows={8}
                  fullWidth
                  inputProps={{
                    "aria-label": t("taskEngineering.review.verificationCommands"),
                    style: { fontFamily: "var(--rc-font-mono)" }
                  }}
                />
              </CardContent>
            </Card>
          </Stack>
          </Paper>

          <Stack spacing={2} sx={{ alignSelf: "start", position: { xl: "sticky" }, top: { xl: 92 } }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {t("taskEngineering.review.assumptionsTitle")}
              </Typography>
              {draft.assumptions.length > 0 ? (
                <Stack component="ul" spacing={1} sx={{ pl: 2.25, mb: 0, color: "text.secondary" }}>
                  {draft.assumptions.map((assumption) => (
                    <Typography key={assumption} component="li" variant="body2">{assumption}</Typography>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t("taskEngineering.review.noAssumptions")}
                </Typography>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {t("taskEngineering.review.requestChange")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("taskEngineering.review.requestChangeHint")}
              </Typography>
              <TextField
                value={feedback}
                onChange={(event) => onFeedbackChange(event.target.value)}
                multiline
                minRows={3}
                fullWidth
                inputProps={{ "aria-label": t("taskEngineering.review.feedbackLabel") }}
                sx={{ mt: 1.5 }}
              />
              <Button
                variant="outlined"
                startIcon={busy ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={onRefine}
                disabled={busy || (!feedback.trim() && Object.keys(answers).length === 0)}
                fullWidth
                sx={{ mt: 1.25 }}
              >
                {t("taskEngineering.review.refine")}
              </Button>
            </Paper>
          </Stack>
        </Box>
      </Stack>

      <Paper
        square
        elevation={0}
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          px: { xs: 2, md: 3 },
          py: 1.5,
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
          backdropFilter: "blur(10px)"
        }}
      >
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1} justifyContent="space-between">
          <Button startIcon={<ArrowBackIcon />} onClick={onBack} disabled={creating}>
            {planning ? t("taskEngineering.review.stopAndBack") : t("taskEngineering.review.backToBrief")}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={busy ? <CircularProgress color="inherit" size={17} /> : <CheckCircleOutlineIcon />}
            onClick={onApprove}
            disabled={busy || !canApprove}
          >
            {busy ? t("taskEngineering.review.creating") : t("taskEngineering.review.approve")}
          </Button>
        </Stack>
      </Paper>
    </Paper>
  );
}

const reviewSectionSx = {
  bgcolor: "transparent",
  border: 0,
  borderRadius: 0,
  borderBottom: "1px solid",
  borderColor: "divider",
  boxShadow: "none",
  "&:last-of-type": { borderBottom: 0 }
} as const;
