import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import UndoIcon from "@mui/icons-material/Undo";
import { Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
import React from "react";
import { runProjectAction } from "../../api/client";
import { ActionButton } from "../shared/ActionButton";
import { EmptyPanel } from "../shared/EmptyPanel";
import { LoadingPanel } from "../shared/LoadingPanel";
import type { CommandResult, GitDetails } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";

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
  const totalChanges = files ? Object.values(files).reduce((total, group) => total + group.length, 0) : 0;
  const stagedCount = files?.staged.length ?? 0;

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
    return <LoadingPanel label="Caricamento changes" />;
  }

  if (!files || !details) {
    return <EmptyPanel label="Changes non disponibili" />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip
          size="small"
          color={details.status.isClean ? "success" : "warning"}
          label={details.status.isClean ? "working tree clean" : `${totalChanges} changes`}
        />
        <Box sx={{ flexGrow: 1 }} />
        <ActionButton
          projectId={projectId}
          actionPath="git/stage-all"
          label="Stage all"
          icon={<AddIcon fontSize="small" />}
          disabled={totalChanges === 0}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="git/unstage-all"
          label="Unstage all"
          icon={<UndoIcon fontSize="small" />}
          disabled={stagedCount === 0}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          gap: 1
        }}
      >
        <ChangeGroup title="Staged" files={files.staged} color="success.main" />
        <ChangeGroup title="Modified" files={files.modified} color="warning.main" />
        <ChangeGroup title="Deleted" files={files.deleted} color="error.main" />
        <ChangeGroup title="Renamed" files={files.renamed} color="info.main" />
        <ChangeGroup title="Untracked" files={files.untracked} color="text.secondary" />
        {files.conflicted.length > 0 ? (
          <ChangeGroup title="Conflicted" files={files.conflicted} color="error.main" />
        ) : null}
      </Box>

      <Divider />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <TextField
          size="small"
          label="Commit message"
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
          sx={{ minWidth: 112 }}
        >
          Commit
        </Button>
        <ActionButton
          projectId={projectId}
          actionPath="git/push"
          label="Push"
          icon={<CloudUploadIcon fontSize="small" />}
          disabled={!details.status.tracking}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>
    </Stack>
  );
}

type ChangeGroupProps = {
  title: string;
  files: string[];
  color: string;
};

function ChangeGroup({ title, files, color }: ChangeGroupProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        minHeight: 128,
        overflow: "hidden"
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
        <Typography variant="body2" sx={{ fontWeight: 800, flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={files.length} />
      </Stack>
      <Box sx={{ px: 1.25, py: 1, maxHeight: 150, overflow: "auto" }}>
        {files.length > 0 ? (
          files.map((file) => (
            <Typography
              key={`${title}-${file}`}
              variant="caption"
              component="div"
              sx={{ fontFamily: "monospace", overflowWrap: "anywhere", py: 0.25 }}
            >
              {file}
            </Typography>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            Nessun file
          </Typography>
        )}
      </Box>
    </Box>
  );
}
