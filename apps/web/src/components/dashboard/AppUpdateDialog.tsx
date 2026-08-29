import CloseIcon from "@mui/icons-material/Close";
import SyncIcon from "@mui/icons-material/Sync";
import { Alert, Box, CircularProgress, Dialog, DialogContent, IconButton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CommandOutput } from "../shared/CommandOutput";
import type { AppUpdateResult } from "../../types/app";

type AppUpdateDialogProps = {
  open: boolean;
  isUpdating: boolean;
  result: AppUpdateResult | null;
  onClose: () => void;
};

export function AppUpdateDialog({ open, isUpdating, result, onClose }: AppUpdateDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isUpdating) {
          onClose();
        }
      }}
      fullWidth
      maxWidth="md"
    >
      <DialogContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SyncIcon color="primary" />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t("dashboard.update.title")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.update.description")}
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={isUpdating} aria-label={t("dashboard.update.close")}>
              <CloseIcon />
            </IconButton>
          </Stack>

          {isUpdating ? (
            <Alert severity="info" icon={<CircularProgress size={18} />}>
              {t("dashboard.update.inProgress")}
            </Alert>
          ) : null}

          {result?.restartScheduled ? (
            <Alert severity="success">
              {t("dashboard.update.restarting")}
            </Alert>
          ) : null}

          {result && !result.ok ? (
            <Alert severity="warning">
              {t("dashboard.update.failed")}
            </Alert>
          ) : null}

          {result ? <CommandOutput result={result} /> : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
