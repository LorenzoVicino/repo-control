import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RestoreIcon from "@mui/icons-material/Restore";
import UndoIcon from "@mui/icons-material/Undo";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import React from "react";
import { runProjectAction } from "../../api/client";
import { ActionButton } from "../shared/ActionButton";
import { EmptyPanel } from "../shared/EmptyPanel";
import { LoadingPanel } from "../shared/LoadingPanel";
import type { CommandResult, GitDetails, GitFileChange, GitFileStatus, GitStashEntry } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";
import { formatDate } from "../../utils/projects";

type ChangesPanelProps = {
  projectId: string;
  details: GitDetails | undefined;
  isLoading: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function ChangesPanel({ projectId, details, isLoading, onResult, onCompleted }: ChangesPanelProps) {
  const [commitMessage, setCommitMessage] = React.useState("");
  const [isCommitting, setIsCommitting] = React.useState(false);
  const files = details?.status.files;
  const stagedFiles = files?.staged ?? [];
  const unstagedFiles = files?.unstaged ?? [];
  const stagedCount = stagedFiles.length;
  const unstagedCount = unstagedFiles.length;
  const totalChanges = stagedCount + unstagedCount;
  const canSync = Boolean(details?.status.tracking);

  async function commitChanges() {
    const message = commitMessage.trim();

    if (!message || stagedCount === 0 || isCommitting) {
      return;
    }

    setIsCommitting(true);

    try {
      const result = await runProjectAction(projectId, "git/commit", "Commit", { message });
      onResult(result);

      if (result.ok) {
        setCommitMessage("");
      }

      onCompleted();
    } catch (error) {
      onResult(commandErrorResult("Commit", error));
    } finally {
      setIsCommitting(false);
    }
  }

  function handleCommitKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void commitChanges();
    }
  }

  if (isLoading) {
    return <LoadingPanel label="Caricamento Git" />;
  }

  if (!files || !details) {
    return <EmptyPanel label="Git non disponibile" />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip
          size="small"
          color={details.status.isClean ? "success" : "warning"}
          label={details.status.isClean ? "working tree clean" : `${totalChanges} changes`}
        />
        <Chip size="small" label={`${stagedCount} staged`} variant="outlined" />
        <Chip size="small" label={`${unstagedCount} unstaged`} variant="outlined" />
        {details.status.tracking ? <Chip size="small" label={details.status.tracking} color="primary" /> : null}
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" },
          gap: 1.25,
          alignItems: "start"
        }}
      >
        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          <GitFileSection
            projectId={projectId}
            title="Staged"
            files={stagedFiles}
            emptyLabel="Nessun file staged"
            bulkActionPath="git/unstage-all"
            bulkActionLabel="Unstage all"
            bulkActionIcon={<UndoIcon fontSize="small" />}
            fileActionPath="git/unstage"
            fileActionLabel="Unstage file"
            fileActionIcon={<UndoIcon fontSize="small" />}
            disabled={stagedCount === 0}
            onResult={onResult}
            onCompleted={onCompleted}
          />
          <GitFileSection
            projectId={projectId}
            title="Unstaged"
            files={unstagedFiles}
            emptyLabel="Nessun file unstaged"
            bulkActionPath="git/stage-all"
            bulkActionLabel="Stage all"
            bulkActionIcon={<AddIcon fontSize="small" />}
            fileActionPath="git/stage"
            fileActionLabel="Stage file"
            fileActionIcon={<AddIcon fontSize="small" />}
            disabled={unstagedCount === 0}
            onResult={onResult}
            onCompleted={onCompleted}
          />
        </Stack>

        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          <GitActionBlock title="Commit">
            <Stack spacing={1}>
              <TextField
                size="small"
                label="Messaggio commit"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                onKeyDown={handleCommitKeyDown}
                disabled={stagedCount === 0}
                fullWidth
              />
              <Button
                variant="contained"
                startIcon={isCommitting ? <CircularProgress color="inherit" size={16} /> : <CheckCircleIcon />}
                onClick={commitChanges}
                disabled={isCommitting || stagedCount === 0 || commitMessage.trim().length === 0}
                fullWidth
              >
                Commit
              </Button>
            </Stack>
          </GitActionBlock>

          <GitActionBlock title="Sync">
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <ActionButton
                  projectId={projectId}
                  actionPath="git/pull"
                  label="Pull"
                  icon={<CloudDownloadIcon fontSize="small" />}
                  disabled={!canSync}
                  onResult={onResult}
                  onCompleted={onCompleted}
                />
                <ActionButton
                  projectId={projectId}
                  actionPath="git/push"
                  label="Push"
                  icon={<CloudUploadIcon fontSize="small" />}
                  disabled={!canSync}
                  onResult={onResult}
                  onCompleted={onCompleted}
                />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label={`${details.status.ahead} ahead`} variant="outlined" />
                <Chip size="small" label={`${details.status.behind} behind`} variant="outlined" />
              </Stack>
            </Stack>
          </GitActionBlock>

          <GitActionBlock title="Stash">
            <Stack spacing={1}>
              <ActionButton
                projectId={projectId}
                actionPath="git/stash"
                label="Stash changes"
                icon={<ArchiveIcon fontSize="small" />}
                disabled={totalChanges === 0}
                onResult={onResult}
                onCompleted={onCompleted}
              />
              <StashList
                projectId={projectId}
                stashes={details.stashes}
                onResult={onResult}
                onCompleted={onCompleted}
              />
            </Stack>
          </GitActionBlock>
        </Stack>
      </Box>
    </Stack>
  );
}

type GitFileSectionProps = {
  projectId: string;
  title: string;
  files: GitFileChange[];
  emptyLabel: string;
  bulkActionPath: string;
  bulkActionLabel: string;
  bulkActionIcon: React.ReactNode;
  fileActionPath: string;
  fileActionLabel: string;
  fileActionIcon: React.ReactNode;
  disabled: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function GitFileSection({
  projectId,
  title,
  files,
  emptyLabel,
  bulkActionPath,
  bulkActionLabel,
  bulkActionIcon,
  fileActionPath,
  fileActionLabel,
  fileActionIcon,
  disabled,
  onResult,
  onCompleted
}: GitFileSectionProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        minWidth: 0
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Typography variant="body2" sx={{ fontWeight: 900, flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={files.length} />
        <ActionButton
          projectId={projectId}
          actionPath={bulkActionPath}
          label={bulkActionLabel}
          icon={bulkActionIcon}
          disabled={disabled}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>

      <Box sx={{ maxHeight: 230, overflow: "auto" }}>
        {files.length > 0 ? (
          files.map((file) => (
            <GitFileRow
              key={`${title}-${file.previousPath ?? ""}-${file.path}-${file.status}`}
              projectId={projectId}
              file={file}
              actionPath={fileActionPath}
              actionLabel={fileActionLabel}
              actionIcon={fileActionIcon}
              onResult={onResult}
              onCompleted={onCompleted}
            />
          ))
        ) : (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ px: 1.25, py: 1.5 }}>
            {emptyLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

type GitFileRowProps = {
  projectId: string;
  file: GitFileChange;
  actionPath: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function GitFileRow({
  projectId,
  file,
  actionPath,
  actionLabel,
  actionIcon,
  onResult,
  onCompleted
}: GitFileRowProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto 34px",
        gap: 0.75,
        alignItems: "center",
        minHeight: 40,
        px: 1.25,
        py: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": {
          borderBottom: 0
        }
      }}
    >
      <Typography
        variant="caption"
        sx={{ minWidth: 0, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}
        title={getGitFileDisplayPath(file)}
        noWrap
      >
        {getGitFileDisplayPath(file)}
      </Typography>
      <Chip
        size="small"
        label={file.label}
        color={getStatusColor(file.status)}
        variant={file.status === "staged" ? "filled" : "outlined"}
        sx={{
          height: 22,
          maxWidth: 92,
          "& .MuiChip-label": {
            px: 0.75,
            overflow: "hidden",
            textOverflow: "ellipsis"
          }
        }}
      />
      <GitFileActionButton
        projectId={projectId}
        actionPath={actionPath}
        label={actionLabel}
        icon={actionIcon}
        file={file}
        onResult={onResult}
        onCompleted={onCompleted}
      />
    </Box>
  );
}

type GitFileActionButtonProps = {
  projectId: string;
  actionPath: string;
  label: string;
  icon: React.ReactNode;
  file: GitFileChange;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function GitFileActionButton({
  projectId,
  actionPath,
  label,
  icon,
  file,
  onResult,
  onCompleted
}: GitFileActionButtonProps) {
  const [isRunning, setIsRunning] = React.useState(false);

  async function runAction() {
    setIsRunning(true);

    try {
      const result = await runProjectAction(projectId, actionPath, label, {
        path: file.path,
        previousPath: file.previousPath
      });
      onResult(result);
      onCompleted();
    } catch (error) {
      onResult(commandErrorResult(label, error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" onClick={runAction} disabled={isRunning} aria-label={label}>
          {isRunning ? <CircularProgress size={16} /> : icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

type GitActionBlockProps = {
  title: string;
  children: React.ReactNode;
};

function GitActionBlock({ title, children }: GitActionBlockProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.25,
        minWidth: 0
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 900, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

type StashListProps = {
  projectId: string;
  stashes: GitStashEntry[];
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function StashList({ projectId, stashes, onResult, onCompleted }: StashListProps) {
  if (stashes.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Nessuno stash
      </Typography>
    );
  }

  return (
    <Stack
      divider={<Divider flexItem />}
      sx={{
        maxHeight: 154,
        overflow: "auto",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 0.75
      }}
    >
      {stashes.map((stash) => (
        <StashRow
          key={stash.ref}
          projectId={projectId}
          stash={stash}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      ))}
    </Stack>
  );
}

type StashRowProps = {
  projectId: string;
  stash: GitStashEntry;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function StashRow({ projectId, stash, onResult, onCompleted }: StashRowProps) {
  const [isRunning, setIsRunning] = React.useState(false);

  async function popStash() {
    setIsRunning(true);

    try {
      const result = await runProjectAction(projectId, "git/stash-pop", `Pop ${stash.ref}`, { ref: stash.ref });
      onResult(result);
      onCompleted();
    } catch (error) {
      onResult(commandErrorResult(`Pop ${stash.ref}`, error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 34px",
        gap: 0.75,
        alignItems: "center",
        px: 1,
        py: 0.75,
        minWidth: 0
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Chip size="small" label={stash.ref} variant="outlined" sx={{ flexShrink: 0 }} />
          <Typography variant="caption" sx={{ minWidth: 0, fontWeight: 700 }} noWrap title={stash.message}>
            {stash.message}
          </Typography>
        </Stack>
        {stash.date ? (
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {formatDate(stash.date)}
          </Typography>
        ) : null}
      </Box>
      <Tooltip title="Pop stash">
        <span>
          <IconButton size="small" onClick={popStash} disabled={isRunning} aria-label={`Pop ${stash.ref}`}>
            {isRunning ? <CircularProgress size={16} /> : <RestoreIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

function getGitFileDisplayPath(file: GitFileChange): string {
  return file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
}

function getStatusColor(status: GitFileStatus): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "staged":
      return "success";
    case "modified":
      return "warning";
    case "deleted":
    case "conflicted":
      return "error";
    case "renamed":
      return "info";
    case "untracked":
      return "default";
  }
}
