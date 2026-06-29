import CloseIcon from "@mui/icons-material/Close";
import SyncIcon from "@mui/icons-material/Sync";
import { Alert, Box, CircularProgress, Dialog, DialogContent, IconButton, Stack, Typography } from "@mui/material";
import { CommandOutput } from "../shared/CommandOutput";
import type { AppUpdateResult } from "../../types";

type AppUpdateDialogProps = {
  open: boolean;
  isUpdating: boolean;
  result: AppUpdateResult | null;
  onClose: () => void;
};

export function AppUpdateDialog({ open, isUpdating, result, onClose }: AppUpdateDialogProps) {
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
                Aggiorna repo-control
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Esegue git pull --ff-only, npm install e riavvia il server locale.
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={isUpdating} aria-label="Close update dialog">
              <CloseIcon />
            </IconButton>
          </Stack>

          {isUpdating ? (
            <Alert severity="info" icon={<CircularProgress size={18} />}>
              Aggiornamento in corso. Non chiudere il terminale.
            </Alert>
          ) : null}

          {result?.restartScheduled ? (
            <Alert severity="success">
              Aggiornamento completato. Il server sta provando a riavviarsi automaticamente.
            </Alert>
          ) : null}

          {result && !result.ok ? (
            <Alert severity="warning">
              Aggiornamento non completato. Controlla l'output e risolvi eventuali modifiche locali.
            </Alert>
          ) : null}

          {result ? <CommandOutput result={result} /> : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
