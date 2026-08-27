import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { useTranslation } from "react-i18next";

type WorkspaceUnavailableProps = {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
  onPickWorkspace: () => void;
};

export function WorkspaceUnavailable({
  error,
  isRetrying,
  onRetry,
  onPickWorkspace
}: WorkspaceUnavailableProps) {
  const { t } = useTranslation();

  return (
    <Paper
      component="section"
      role="alert"
      aria-labelledby="workspace-unavailable-title"
      variant="outlined"
      sx={{
        minHeight: 420,
        display: "grid",
        placeItems: "center",
        p: { xs: 2.5, sm: 4 },
        borderColor: "error.main",
        bgcolor: "background.paper"
      }}
    >
      <Stack spacing={2} alignItems="center" textAlign="center" sx={{ maxWidth: 620 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 52,
            height: 52,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            color: "error.main",
            bgcolor: "action.hover"
          }}
        >
          <ReportProblemOutlinedIcon sx={{ fontSize: 28 }} />
        </Box>
        <Box>
          <Typography id="workspace-unavailable-title" component="h1" variant="h1">
            {t("workspaceState.unavailableTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
            {t("workspaceState.unavailableDescription")}
          </Typography>
        </Box>
        <Box
          sx={{
            width: "100%",
            p: 1.25,
            border: "1px solid",
            borderColor: "error.main",
            borderRadius: 1,
            color: "error.main",
            bgcolor: "action.hover",
            textAlign: "left",
            fontFamily: "var(--rc-font-mono)",
            fontSize: 12,
            overflowWrap: "anywhere"
          }}
        >
          {getErrorMessage(error, t("workspaceState.unknownError"))}
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          <Button
            variant="contained"
            startIcon={isRetrying ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon />}
            disabled={isRetrying}
            onClick={onRetry}
            sx={{ minHeight: 44 }}
          >
            {isRetrying ? t("workspaceState.retrying") : t("workspaceState.retry")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpenRoundedIcon />}
            onClick={onPickWorkspace}
            sx={{ minHeight: 44 }}
          >
            {t("workspaceState.changeWorkspace")}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

type WorkspaceStaleNoticeProps = {
  error: unknown;
  dataUpdatedAt: number;
  isRetrying: boolean;
  onRetry: () => void;
};

export function WorkspaceStaleNotice({
  error,
  dataUpdatedAt,
  isRetrying,
  onRetry
}: WorkspaceStaleNoticeProps) {
  const { t, i18n } = useTranslation();
  const lastUpdated = dataUpdatedAt > 0
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(dataUpdatedAt)
    : null;

  return (
    <Alert
      severity="warning"
      role="status"
      action={(
        <Button
          color="inherit"
          size="small"
          startIcon={isRetrying ? <CircularProgress size={14} color="inherit" /> : <RefreshRoundedIcon />}
          disabled={isRetrying}
          onClick={onRetry}
          sx={{ minHeight: { xs: 44, sm: 32 } }}
        >
          {isRetrying ? t("workspaceState.retrying") : t("workspaceState.retry")}
        </Button>
      )}
      sx={{ alignItems: "center" }}
    >
      <AlertTitle>{t("workspaceState.staleTitle")}</AlertTitle>
      <Typography variant="body2" component="span">
        {t("workspaceState.staleDescription", { lastUpdated: lastUpdated ?? t("workspaceState.unknownUpdateTime") })}
      </Typography>
      <Typography
        variant="caption"
        component="div"
        sx={{ mt: 0.4, color: "inherit", fontFamily: "var(--rc-font-mono)", opacity: 0.86 }}
      >
        {getErrorMessage(error, t("workspaceState.unknownError"))}
      </Typography>
    </Alert>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
