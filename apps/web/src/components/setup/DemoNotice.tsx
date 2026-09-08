import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

export function DemoNotice() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  return (
    <>
      <Alert severity="info" icon={false}>
        <Stack spacing={1}>
          <Typography fontWeight={600}>{t("setup.demo")}</Typography>
          <Typography variant="body2">{t("setup.demoHint")}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              onClick={() => setOpen(true)}
            >
              {t("setup.local")}
            </Button>
            <Button size="small" onClick={() => window.location.reload()}>
              {t("setup.reset")}
            </Button>
          </Stack>
        </Stack>
      </Alert>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="demo-install-title"
      >
        <DialogTitle id="demo-install-title">{t("setup.local")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{t("setup.localHint")}</Typography>
          <TextField
            fullWidth
            label="Windows · PowerShell"
            value="npx.cmd repo-control ."
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label="macOS · Linux · WSL"
            value="npx repo-control ."
            slotProps={{ input: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  navigator.userAgent.includes("Windows")
                    ? "npx.cmd repo-control ."
                    : "npx repo-control .",
                )
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {t(copied ? "setup.copied" : "setup.copy")}
          </Button>
          <Button onClick={() => setOpen(false)}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
