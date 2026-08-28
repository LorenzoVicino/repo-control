import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography
} from "@mui/material";
import { useTranslation } from "react-i18next";

export type PreferenceFailureKind = "load" | "migration" | "save";

export type PreferenceFailure = {
  kind: PreferenceFailureKind;
  error: unknown;
  favoriteProjectIds?: string[];
};

type PreferenceSyncNoticeProps = {
  failure: PreferenceFailure;
  isRetrying: boolean;
  onRetry: () => void;
  onDismiss?: () => void;
};

export function PreferenceSyncNotice({
  failure,
  isRetrying,
  onRetry,
  onDismiss
}: PreferenceSyncNoticeProps) {
  const { t } = useTranslation();

  return (
    <Alert severity="error" role="alert" sx={{ alignItems: "flex-start" }}>
      <AlertTitle>{t(`preferenceState.${failure.kind}Title`)}</AlertTitle>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "flex-end" }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" component="div">
            {t(`preferenceState.${failure.kind}Description`)}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            sx={{
              mt: 0.65,
              color: "inherit",
              fontFamily: "var(--rc-font-mono)",
              overflowWrap: "anywhere"
            }}
          >
            {getErrorMessage(failure.error, t("preferenceState.unknownError"))}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
          <Button
            color="inherit"
            variant="outlined"
            startIcon={isRetrying ? <CircularProgress size={15} color="inherit" /> : <RefreshRoundedIcon />}
            disabled={isRetrying}
            onClick={onRetry}
            sx={{ minHeight: 44 }}
          >
            {isRetrying ? t("preferenceState.retrying") : t("preferenceState.retry")}
          </Button>
          {onDismiss ? (
            <Button color="inherit" onClick={onDismiss} sx={{ minHeight: 44 }}>
              {t("preferenceState.dismiss")}
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Alert>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
