import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SyncIcon from "@mui/icons-material/Sync";
import SearchIcon from "@mui/icons-material/Search";
import { Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { runProjectAction } from "../../api/projects";
import { ActionButton } from "../shared/ActionButton";
import { EmptyPanel } from "../shared/EmptyPanel";
import { LoadingPanel } from "../shared/LoadingPanel";
import type { CommandResult } from "../../types/common";
import type { GitBranchInfo, GitDetails } from "../../types/git";
import { commandErrorResult } from "../../utils/commandResult";
import { formatDate } from "../../utils/projects";

const INITIAL_VISIBLE_BRANCHES = 12;
const BRANCH_REVEAL_BATCH_SIZE = 24;

type BranchesPanelProps = {
  projectId: string;
  details: GitDetails | undefined;
  isLoading: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function BranchesPanel({ projectId, details, isLoading, onResult, onCompleted }: BranchesPanelProps) {
  const { t } = useTranslation();
  const [newBranchName, setNewBranchName] = React.useState("");
  const [runningBranchAction, setRunningBranchAction] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
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

    void runBranchAction("create", t("project.branches.createAction", { branch }), "git/branch", { branch });
  }

  if (isLoading) {
    return <LoadingPanel label={t("project.branches.loading")} />;
  }

  if (!details) {
    return <EmptyPanel label={t("project.branches.unavailable")} />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip color="primary" label={details.status.current} />
        {details.status.tracking ? <Chip variant="outlined" label={details.status.tracking} /> : null}
        {details.branches.defaultBranch ? <Chip variant="outlined" label={t("project.branches.defaultBranch", { branch: details.branches.defaultBranch })} /> : null}
        {details.status.ahead > 0
          ? <Chip color="info" label={t("project.branches.ahead", { total: details.status.ahead })} />
          : null}
        {details.status.behind > 0
          ? <Chip color="secondary" label={t("project.branches.behind", { total: details.status.behind })} />
          : null}
        {isDirty ? <Chip color="warning" label={t("project.branches.dirtyBlocked")} /> : null}
        <Box sx={{ flexGrow: 1 }} />
        <ActionButton
          projectId={projectId}
          actionPath="git/fetch"
          label={t("project.branches.fetch")}
          icon={<CloudDownloadIcon fontSize="small" />}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="git/pull"
          label={t("project.branches.pullFfOnly")}
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
            label={t("project.branches.searchBranch")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.75, color: "text.secondary" }} /> }}
            fullWidth
          />
          <TextField
            size="small"
            label={t("project.branches.newBranch")}
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
            {t("project.branches.create")}
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
          title={t("project.branches.local")}
          branches={filterBranches(details.branches.local, search)}
          isDirty={isDirty}
          runningBranchAction={runningBranchAction}
          onCheckout={(branch) =>
            runBranchAction(
              `checkout:${branch.name}`,
              t("project.branches.checkoutAction", { branch: branch.name }),
              "git/checkout",
              { branch: branch.name, remote: false }
            )
          }
        />
        <BranchGroup
          title={t("project.branches.remote")}
          branches={filterBranches(details.branches.remote, search)}
          isDirty={isDirty}
          runningBranchAction={runningBranchAction}
          onCheckout={(branch) =>
            runBranchAction(
              `checkout:${branch.name}`,
              t("project.branches.checkoutAction", { branch: branch.name }),
              "git/checkout",
              { branch: branch.name, remote: true }
            )
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
  const { t } = useTranslation();
  const [visibleBranchCount, setVisibleBranchCount] = React.useState(INITIAL_VISIBLE_BRANCHES);
  const [, startRevealTransition] = React.useTransition();
  const visibleBranches = branches.slice(0, visibleBranchCount);
  const hiddenBranchCount = branches.length - visibleBranches.length;

  React.useEffect(() => setVisibleBranchCount(INITIAL_VISIBLE_BRANCHES), [branches]);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <AccountTreeIcon fontSize="small" color="primary" />
        <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={branches.length} />
      </Stack>
      <Stack spacing={0.75} sx={{ p: 1, maxHeight: 320, overflow: "auto" }}>
        {branches.length > 0 ? (
          visibleBranches.map((branch) => (
            <BranchRow
              key={`${title}-${branch.name}`}
              branch={branch}
              isDirty={isDirty}
              isRunning={runningBranchAction === `checkout:${branch.name}`}
              onCheckout={onCheckout}
            />
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t("project.branches.noBranch")}
          </Typography>
        )}
        {hiddenBranchCount > 0 ? (
          <Button
            size="small"
            variant="text"
            startIcon={<ExpandMoreIcon />}
            onClick={() => {
              startRevealTransition(() => {
                setVisibleBranchCount((currentCount) => currentCount + BRANCH_REVEAL_BATCH_SIZE);
              });
            }}
            sx={{ alignSelf: "stretch" }}
          >
            {t("project.branches.showMore", {
              total: Math.min(hiddenBranchCount, BRANCH_REVEAL_BATCH_SIZE)
            })}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

type BranchRowProps = {
  branch: GitBranchInfo;
  isDirty: boolean;
  isRunning: boolean;
  onCheckout: (branch: GitBranchInfo) => void;
};

const BranchRow = React.memo(function BranchRow({ branch, isDirty, isRunning, onCheckout }: BranchRowProps) {
  const { t, i18n } = useTranslation();

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
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {branch.name}
          </Typography>
          {branch.lastCommit ? (
            <Typography variant="caption" color="text.secondary" noWrap component="div" title={branch.lastCommit.message}>
              {branch.lastCommit.hash} · {branch.lastCommit.message} · {formatDate(branch.lastCommit.date, i18n.language)}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
            {branch.current
              ? <Chip size="small" color="primary" label={t("project.branches.chipCurrent")} />
              : null}
            {branch.remote
              ? <Chip size="small" variant="outlined" label={t("project.branches.chipRemote")} />
              : null}
            {branch.upstream ? <Chip size="small" variant="outlined" label={branch.upstream} /> : null}
            {branch.ahead > 0 ? <Chip size="small" color="info" label={t("project.branches.ahead", { total: branch.ahead })} /> : null}
            {branch.behind > 0 ? <Chip size="small" color="secondary" label={t("project.branches.behind", { total: branch.behind })} /> : null}
            {branch.merged && !branch.current ? <Chip size="small" color="success" variant="outlined" label={t("project.branches.chipMerged")} /> : null}
          </Stack>
        </Box>
        <Button
          size="small"
          variant={branch.current ? "contained" : "outlined"}
          onClick={() => onCheckout(branch)}
          disabled={branch.current || isDirty || isRunning}
          startIcon={isRunning ? <CircularProgress size={14} /> : <AccountTreeIcon fontSize="small" />}
          sx={{ minWidth: 106 }}
        >
          {t("project.branches.checkout")}
        </Button>
      </Stack>
    </Box>
  );
});

function filterBranches(branches: GitBranchInfo[], search: string): GitBranchInfo[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return branches;
  return branches.filter((branch) =>
    [branch.name, branch.upstream ?? "", branch.lastCommit?.message ?? "", branch.lastCommit?.author ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(query))
  );
}
