import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import SyncIcon from "@mui/icons-material/Sync";
import { Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import React from "react";
import { runProjectAction } from "../../api/client";
import { ActionButton } from "../shared/ActionButton";
import { EmptyPanel } from "../shared/EmptyPanel";
import { LoadingPanel } from "../shared/LoadingPanel";
import type { CommandResult, GitBranchInfo, GitDetails } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";

type BranchesPanelProps = {
  projectId: string;
  details: GitDetails | undefined;
  isLoading: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function BranchesPanel({ projectId, details, isLoading, onResult, onCompleted }: BranchesPanelProps) {
  const [newBranchName, setNewBranchName] = React.useState("");
  const [runningBranchAction, setRunningBranchAction] = React.useState<string | null>(null);
  const isDirty = details ? !details.status.isClean : false;

  async function runBranchAction(actionKey: string, label: string, actionPath: string, body?: unknown) {
    setRunningBranchAction(actionKey);

    try {
      const result = await runProjectAction(projectId, actionPath, label, body);
      onResult(result);

      if (result.ok && actionPath === "git/branch") {
        setNewBranchName("");
      }

      onCompleted();
    } catch (error) {
      onResult(commandErrorResult(label, error));
    } finally {
      setRunningBranchAction(null);
    }
  }

  function createBranch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const branch = newBranchName.trim();

    if (!branch || isDirty) {
      return;
    }

    void runBranchAction("create", `Create branch ${branch}`, "git/branch", { branch });
  }

  if (isLoading) {
    return <LoadingPanel label="Caricamento branches" />;
  }

  if (!details) {
    return <EmptyPanel label="Branches non disponibili" />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip color="primary" label={details.status.current} />
        {details.status.tracking ? <Chip variant="outlined" label={details.status.tracking} /> : null}
        {details.status.ahead > 0 ? <Chip color="info" label={`ahead ${details.status.ahead}`} /> : null}
        {details.status.behind > 0 ? <Chip color="secondary" label={`behind ${details.status.behind}`} /> : null}
        {isDirty ? <Chip color="warning" label="checkout bloccato: dirty" /> : null}
        <Box sx={{ flexGrow: 1 }} />
        <ActionButton
          projectId={projectId}
          actionPath="git/fetch"
          label="Fetch"
          icon={<CloudDownloadIcon fontSize="small" />}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="git/pull"
          label="Pull ff-only"
          icon={<SyncIcon fontSize="small" />}
          disabled={!details.status.tracking}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>

      <Box component="form" onSubmit={createBranch}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Nuovo branch"
            value={newBranchName}
            onChange={(event) => setNewBranchName(event.target.value)}
            disabled={isDirty}
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={runningBranchAction === "create" ? <CircularProgress color="inherit" size={16} /> : <AddIcon />}
            disabled={isDirty || newBranchName.trim().length === 0 || runningBranchAction === "create"}
            sx={{ minWidth: 138 }}
          >
            Create
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 1
        }}
      >
        <BranchGroup
          title="Local branches"
          branches={details.branches.local}
          isDirty={isDirty}
          runningBranchAction={runningBranchAction}
          onCheckout={(branch) =>
            runBranchAction(`checkout:${branch.name}`, `Checkout ${branch.name}`, "git/checkout", {
              branch: branch.name,
              remote: false
            })
          }
        />
        <BranchGroup
          title="Remote branches"
          branches={details.branches.remote}
          isDirty={isDirty}
          runningBranchAction={runningBranchAction}
          onCheckout={(branch) =>
            runBranchAction(`checkout:${branch.name}`, `Checkout ${branch.name}`, "git/checkout", {
              branch: branch.name,
              remote: true
            })
          }
        />
      </Box>
    </Stack>
  );
}

type BranchGroupProps = {
  title: string;
  branches: GitBranchInfo[];
  isDirty: boolean;
  runningBranchAction: string | null;
  onCheckout: (branch: GitBranchInfo) => void;
};

function BranchGroup({ title, branches, isDirty, runningBranchAction, onCheckout }: BranchGroupProps) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <AccountTreeIcon fontSize="small" color="primary" />
        <Typography variant="body2" sx={{ fontWeight: 800, flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={branches.length} />
      </Stack>
      <Stack spacing={0.75} sx={{ p: 1, maxHeight: 320, overflow: "auto" }}>
        {branches.length > 0 ? (
          branches.map((branch) => (
            <BranchRow
              key={`${title}-${branch.name}`}
              branch={branch}
              isDirty={isDirty}
              isRunning={runningBranchAction === `checkout:${branch.name}`}
              onCheckout={() => onCheckout(branch)}
            />
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            Nessun branch
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

type BranchRowProps = {
  branch: GitBranchInfo;
  isDirty: boolean;
  isRunning: boolean;
  onCheckout: () => void;
};

function BranchRow({ branch, isDirty, isRunning, onCheckout }: BranchRowProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: branch.current ? "primary.main" : "divider",
        borderRadius: 1,
        p: 1
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {branch.name}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
            {branch.current ? <Chip size="small" color="primary" label="current" /> : null}
            {branch.remote ? <Chip size="small" variant="outlined" label="remote" /> : null}
            {branch.upstream ? <Chip size="small" variant="outlined" label={branch.upstream} /> : null}
            {branch.ahead > 0 ? <Chip size="small" color="info" label={`ahead ${branch.ahead}`} /> : null}
            {branch.behind > 0 ? <Chip size="small" color="secondary" label={`behind ${branch.behind}`} /> : null}
          </Stack>
        </Box>
        <Button
          size="small"
          variant={branch.current ? "contained" : "outlined"}
          onClick={onCheckout}
          disabled={branch.current || isDirty || isRunning}
          startIcon={isRunning ? <CircularProgress size={14} /> : <AccountTreeIcon fontSize="small" />}
          sx={{ minWidth: 106 }}
        >
          Checkout
        </Button>
      </Stack>
    </Box>
  );
}
