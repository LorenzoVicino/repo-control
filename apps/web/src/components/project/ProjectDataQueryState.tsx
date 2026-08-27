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
import React from "react";
import { useTranslation } from "react-i18next";

export type ProjectDataFailure = {
  resource: string;
  error: unknown;
};

type ProjectDataUnavailableProps = ProjectDataFailure & {
  isRetrying: boolean;
  onRetry: () => void;
};

export function ProjectDataUnavailable({
  resource,
  error,
  isRetrying,
  onRetry
}: ProjectDataUnavailableProps) {
  const { t } = useTranslation();
  const titleId = React.useId();

  return (
    <Paper
      component="section"
      role="alert"
      aria-labelledby={titleId}
      variant="outlined"
      sx={{
        minHeight: 280,
        display: "grid",
        placeItems: "center",
        p: { xs: 2.5, sm: 3.5 },
        borderColor: "error.main",
        bgcolor: "background.paper"
      }}
    >
      <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ width: "100%", maxWidth: 580 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            color: "error.main",
            bgcolor: "action.hover"
          }}
        >
          <ReportProblemOutlinedIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box>
          <Typography id={titleId} component="h2" variant="h2">
            {t("projectDataState.unavailableTitle", { resource })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>
            {t("projectDataState.unavailableDescription")}
          </Typography>
        </Box>
        <ErrorDetail>{getErrorMessage(error, t("projectDataState.unknownError"))}</ErrorDetail>
        <Button
          variant="contained"
          startIcon={isRetrying ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon />}
          disabled={isRetrying}
          onClick={onRetry}
          sx={{ minHeight: 44 }}
        >
          {isRetrying ? t("projectDataState.retrying") : t("projectDataState.retry")}
        </Button>
      </Stack>
    </Paper>
  );
}

type ProjectDataStaleNoticeProps = {
  failures: ProjectDataFailure[];
  isRetrying: boolean;
  onRetry: () => void;
};

export function ProjectDataStaleNotice({
  failures,
  isRetrying,
  onRetry
}: ProjectDataStaleNoticeProps) {
  const { t } = useTranslation();

  if (failures.length === 0) return null;

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
          {isRetrying ? t("projectDataState.retrying") : t("projectDataState.retry")}
        </Button>
      )}
      sx={{ alignItems: "center" }}
    >
      <AlertTitle>{t("projectDataState.partialTitle")}</AlertTitle>
      <Typography variant="body2" component="div">
        {t("projectDataState.partialDescription")}
      </Typography>
      <Stack component="ul" spacing={0.25} sx={{ m: 0, mt: 0.65, pl: 2.25 }}>
        {failures.map((failure) => (
          <Typography
            key={failure.resource}
            component="li"
            variant="caption"
            sx={{ color: "inherit", fontFamily: "var(--rc-font-mono)", overflowWrap: "anywhere" }}
          >
            {failure.resource}: {getErrorMessage(failure.error, t("projectDataState.unknownError"))}
          </Typography>
        ))}
      </Stack>
    </Alert>
  );
}

function ErrorDetail({ children }: React.PropsWithChildren) {
  return (
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
      {children}
    </Box>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
