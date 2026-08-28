import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { CommandResult, ProjectOperationSource } from "../../types/common";

export type VisibleOperationSource = Exclude<ProjectOperationSource, "terminal">;

export type OperationRecord = {
  id: string;
  scope: string;
  source: VisibleOperationSource;
  result: CommandResult;
  completedAt: number;
};

type OperationFeedbackProps = {
  records: OperationRecord[];
  notificationId: string | null;
  onDismissNotification: () => void;
  onClear: () => void;
};

export function OperationFeedback({
  records,
  notificationId,
  onDismissNotification,
  onClear
}: OperationFeedbackProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "error">("idle");
  const notification = records.find((record) => record.id === notificationId) ?? null;
  const selectedRecord = records.find((record) => record.id === selectedRecordId)
    ?? records[0]
    ?? null;

  React.useEffect(() => {
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(records[0]?.id ?? null);
    }
  }, [records, selectedRecordId]);

  React.useEffect(() => {
    if (copyState === "idle") return undefined;
    const timeoutId = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  function openHistory(recordId?: string) {
    setSelectedRecordId(recordId ?? records[0]?.id ?? null);
    setDialogOpen(true);
    onDismissNotification();
  }

  async function copySelectedRecord() {
    if (!selectedRecord) return;

    try {
      await navigator.clipboard.writeText(serializeOperation(selectedRecord));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <>
      {notification ? (
        <Snackbar
          open
          autoHideDuration={notification.result.ok ? 5000 : null}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          onClose={(_, reason) => {
            if (reason !== "clickaway") onDismissNotification();
          }}
          sx={{ bottom: { xs: 72, sm: 20 } }}
        >
          <Alert
            severity={notification.result.ok ? "success" : "error"}
            role={notification.result.ok ? "status" : "alert"}
            variant="filled"
            action={(
              <Stack direction="row" spacing={0.25} alignItems="center">
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => openHistory(notification.id)}
                  sx={{ minHeight: { xs: 44, sm: 32 } }}
                >
                  {t("operations.details")}
                </Button>
                <IconButton
                  color="inherit"
                  size="small"
                  aria-label={t("operations.dismiss")}
                  onClick={onDismissNotification}
                  sx={{ width: { xs: 44, sm: 32 }, height: { xs: 44, sm: 32 } }}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
            sx={{ width: "min(620px, calc(100vw - 24px))", alignItems: "center" }}
          >
            <AlertTitle sx={{ mb: 0.2 }}>
              {notification.result.ok
                ? t("operations.completed", { source: getSourceLabel(notification.source, t) })
                : t("operations.failed", { source: getSourceLabel(notification.source, t) })}
            </AlertTitle>
            <Typography variant="caption" component="div" sx={{ color: "inherit" }}>
              {notification.scope} · {notification.result.command}
            </Typography>
          </Alert>
        </Snackbar>
      ) : null}

      {records.length > 0 ? (
        <Button
          variant="outlined"
          size="small"
          startIcon={<HistoryRoundedIcon />}
          aria-label={t("operations.openHistoryAria", { count: records.length })}
          onClick={() => openHistory()}
          sx={{
            position: "fixed",
            zIndex: theme.zIndex.snackbar - 1,
            right: { xs: 12, sm: 20 },
            bottom: { xs: 12, sm: 20 },
            minHeight: 44,
            bgcolor: "background.paper",
            boxShadow: 3
          }}
        >
          {t("operations.history")}
          <Chip size="small" label={records.length} sx={{ ml: 1, height: 19 }} />
        </Button>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="md"
        aria-labelledby="operation-history-title"
      >
        <DialogTitle id="operation-history-title">{t("operations.title")}</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box
            sx={{
              minHeight: { sm: 440 },
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "260px minmax(0, 1fr)" }
            }}
          >
            <Box
              component="nav"
              aria-label={t("operations.historyAria")}
              sx={{ borderRight: { sm: "1px solid" }, borderBottom: { xs: "1px solid", sm: 0 }, borderColor: "divider" }}
            >
              <List disablePadding sx={{ maxHeight: { xs: 210, sm: 520 }, overflowY: "auto" }}>
                {records.map((record) => (
                  <ListItemButton
                    key={record.id}
                    selected={record.id === selectedRecord?.id}
                    onClick={() => setSelectedRecordId(record.id)}
                    sx={{ alignItems: "flex-start", borderBottom: "1px solid", borderColor: "divider" }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, mt: 0.35, color: record.result.ok ? "success.main" : "error.main" }}>
                      {record.result.ok
                        ? <CheckCircleOutlineRoundedIcon fontSize="small" />
                        : <ErrorOutlineRoundedIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={record.result.command}
                      secondary={`${record.scope} · ${formatOperationTime(record.completedAt, i18n.resolvedLanguage ?? i18n.language)}`}
                      primaryTypographyProps={{ variant: "body2", noWrap: true }}
                      secondaryTypographyProps={{ variant: "caption", noWrap: true }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>

            {selectedRecord ? (
              <Stack spacing={2} sx={{ minWidth: 0, p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Chip
                    size="small"
                    color={selectedRecord.result.ok ? "success" : "error"}
                    label={selectedRecord.result.ok ? t("operations.success") : t("operations.failure")}
                  />
                  <Chip size="small" variant="outlined" label={getSourceLabel(selectedRecord.source, t)} />
                  <Typography variant="caption" color="text.secondary">
                    {formatOperationTime(selectedRecord.completedAt, i18n.resolvedLanguage ?? i18n.language)}
                  </Typography>
                </Stack>

                <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "6px 14px" }}>
                  <DetailTerm>{t("operations.scope")}</DetailTerm>
                  <DetailValue>{selectedRecord.scope}</DetailValue>
                  <DetailTerm>{t("operations.command")}</DetailTerm>
                  <DetailValue mono>{selectedRecord.result.command}</DetailValue>
                  <DetailTerm>{t("operations.exitCode")}</DetailTerm>
                  <DetailValue mono>{selectedRecord.result.exitCode ?? "—"}</DetailValue>
                  <DetailTerm>{t("operations.duration")}</DetailTerm>
                  <DetailValue mono>{formatDuration(selectedRecord.result.durationMs)}</DetailValue>
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h2" variant="h3" sx={{ mb: 0.75 }}>
                    {t("operations.output")}
                  </Typography>
                  <Box
                    component="pre"
                    tabIndex={0}
                    sx={{
                      m: 0,
                      minHeight: 180,
                      maxHeight: 300,
                      overflow: "auto",
                      p: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: "background.default",
                      color: selectedRecord.result.ok ? "text.primary" : "error.main",
                      fontFamily: "var(--rc-font-mono)",
                      fontSize: 12,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {getOperationOutput(selectedRecord.result) || t("operations.noOutput")}
                  </Box>
                </Box>
              </Stack>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button
            color="inherit"
            sx={{ minHeight: { xs: 44, sm: 36 } }}
            onClick={() => {
              onClear();
              setDialogOpen(false);
            }}
          >
            {t("operations.clear")}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => void copySelectedRecord()}
              disabled={!selectedRecord}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
            >
              {copyState === "copied"
                ? t("operations.copied")
                : copyState === "error"
                  ? t("operations.copyFailed")
                  : t("operations.copy")}
            </Button>
            <Button
              variant="contained"
              onClick={() => setDialogOpen(false)}
              sx={{ minHeight: { xs: 44, sm: 36 } }}
            >
              {t("operations.close")}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DetailTerm({ children }: React.PropsWithChildren) {
  return <Typography component="dt" variant="caption" color="text.secondary">{children}</Typography>;
}

function DetailValue({ children, mono = false }: React.PropsWithChildren<{ mono?: boolean }>) {
  return (
    <Typography
      component="dd"
      variant="caption"
      sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", fontFamily: mono ? "var(--rc-font-mono)" : undefined }}
    >
      {children}
    </Typography>
  );
}

function getSourceLabel(source: VisibleOperationSource, t: TFunction): string {
  if (source === "overview") return t("operations.sources.overview");
  if (source === "changes") return t("operations.sources.changes");
  if (source === "branches") return t("operations.sources.branches");
  return t("operations.sources.docker");
}

function getOperationOutput(result: CommandResult): string {
  return result.output.trim() || result.stderr.trim() || result.stdout.trim();
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.max(0, Math.round(durationMs))} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

function formatOperationTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function serializeOperation(record: OperationRecord): string {
  return [
    `Scope: ${record.scope}`,
    `Source: ${record.source}`,
    `Command: ${record.result.command}`,
    `Success: ${record.result.ok}`,
    `Exit code: ${record.result.exitCode ?? "—"}`,
    `Duration: ${formatDuration(record.result.durationMs)}`,
    "",
    getOperationOutput(record.result)
  ].join("\n");
}
