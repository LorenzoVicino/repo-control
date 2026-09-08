import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { jsonRequest, requestJson } from "../../api/http";
import { pickWorkspaceFolder } from "../../api/workspace";
import type { ProjectSummary } from "../../types/projects";

type SetupStatus = {
  completed: boolean;
  existing: boolean;
};

type SetupTools = {
  tools: Array<{
    id: string;
    label: string;
    required: boolean;
    status: "available" | "missing" | "unreachable";
  }>;
};

export function WorkspaceSetup({
  root,
  projects,
  scanning,
  onChangeRoot,
  onOpenProject,
  requested,
  onClose,
}: {
  root: string;
  projects: ProjectSummary[];
  scanning: boolean;
  onChangeRoot: (root: string) => Promise<void>;
  onOpenProject: (id: string) => void;
  requested: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const status = useQuery({
    queryKey: ["setup"],
    queryFn: () => requestJson<SetupStatus>("/api/setup", t("setup.error")),
    retry: false,
    staleTime: Infinity,
  });
  const [opened, setOpened] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [folder, setFolder] = React.useState(root);
  const [selected, setSelected] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const open =
    requested ||
    opened ||
    Boolean(
      status.data &&
      !status.data.existing &&
      !status.data.completed &&
      !dismissed,
    );
  const tools = useQuery({
    queryKey: ["setup-tools"],
    queryFn: () =>
      requestJson<SetupTools>("/api/setup/tools", t("setup.error")),
    enabled: open && step === 1,
    retry: false,
    staleTime: 30_000,
  });
  React.useEffect(() => {
    setFolder(root);
  }, [root]);
  const projectId = projects.some((project) => project.id === selected)
    ? selected
    : (projects[0]?.id ?? "");

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("setup.error"));
    } finally {
      setBusy(false);
    }
  }
  async function finish(openRepository: boolean) {
    await perform(async () => {
      await requestJson(
        "/api/setup",
        t("setup.error"),
        jsonRequest("PUT", { version: 1 }),
      );
      setDismissed(true);
      setOpened(false);
      setStep(0);
      onClose();
      if (openRepository && projectId) onOpenProject(projectId);
    });
  }

  return (
    <>
      {!open && !dismissed && status.data && !status.data.completed && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Button onClick={() => setOpened(true)}>{t("setup.start")}</Button>
              <IconButton
                aria-label={t("common.close")}
                size="small"
                onClick={() => void finish(false)}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          }
        >
          {t("setup.invitation")}
        </Alert>
      )}
      <Dialog
        open={open}
        onClose={busy ? undefined : () => void finish(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="setup-title"
      >
        <DialogTitle id="setup-title">{t("setup.title")}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={step} alternativeLabel sx={{ my: 2 }}>
            {(["workspace", "tools", "repository"] as const).map((key) => (
              <Step key={key}>
                <StepLabel>{t(`setup.${key}`)}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Stack spacing={2} sx={{ pt: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {step === 0 && (
              <>
                <Typography color="text.secondary">
                  {t("setup.pathHint")}
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  label={t("setup.folder")}
                  value={folder}
                  disabled={busy}
                  onChange={(event) => setFolder(event.target.value)}
                />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        const picked = await pickWorkspaceFolder(folder);
                        if (picked) {
                          setFolder(picked);
                          await onChangeRoot(picked);
                        }
                      })
                    }
                  >
                    {t("setup.browse")}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={busy || !folder.trim()}
                    onClick={() =>
                      void perform(() => onChangeRoot(folder.trim()))
                    }
                  >
                    {t("setup.scan")}
                  </Button>
                </Stack>
                <Typography role="status">
                  {scanning || busy
                    ? t("setup.scanning")
                    : t("setup.count", { count: projects.length })}
                </Typography>
                {!scanning && projects.length === 0 && (
                  <Alert severity="info">{t("setup.empty")}</Alert>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <Typography color="text.secondary">
                  {t("setup.optional")}
                </Typography>
                {tools.isFetching && (
                  <Box role="status">
                    <CircularProgress size={18} /> {t("setup.checking")}
                  </Box>
                )}
                {tools.isError && (
                  <Alert severity="error">{t("setup.error")}</Alert>
                )}
                {tools.data?.tools.map((tool) => (
                  <Stack
                    key={tool.id}
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      pb: 1,
                    }}
                  >
                    <Typography>
                      {tool.label}
                      {tool.required ? ` · ${t("setup.required")}` : ""}
                    </Typography>
                    <Typography
                      color={
                        tool.status === "available"
                          ? "success.main"
                          : "text.secondary"
                      }
                    >
                      {t(`setup.${tool.status}`)}
                    </Typography>
                  </Stack>
                ))}
                {tools.data?.tools.some(
                  (tool) => tool.required && tool.status === "missing",
                ) && <Alert severity="warning">{t("setup.gitMissing")}</Alert>}
                <Button
                  disabled={tools.isFetching}
                  onClick={() => void tools.refetch()}
                >
                  {t("setup.retry")}
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Typography>{t("setup.hint")}</Typography>
                {projects.length > 0 ? (
                  <TextField
                    select
                    fullWidth
                    label={t("setup.choose")}
                    value={projectId}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    {projects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.name} · {project.branch}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Alert severity="info">{t("setup.empty")}</Alert>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexWrap: "wrap", gap: 1 }}>
          <Button disabled={busy} onClick={() => void finish(false)}>
            {t("setup.skip")}
          </Button>
          <Box sx={{ flex: 1 }} />
          {step > 0 && (
            <Button disabled={busy} onClick={() => setStep(step - 1)}>
              {t("setup.back")}
            </Button>
          )}
          <Button
            variant="contained"
            disabled={busy || scanning || (step === 0 && !folder.trim())}
            onClick={() =>
              step === 2
                ? void finish(true)
                : void perform(async () => {
                    if (step === 0 && folder.trim() !== root)
                      await onChangeRoot(folder.trim());
                    setStep(step + 1);
                  })
            }
          >
            {step === 2
              ? t(projectId ? "setup.finish" : "setup.done")
              : t("setup.next")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
