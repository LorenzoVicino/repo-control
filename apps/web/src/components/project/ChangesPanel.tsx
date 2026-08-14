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
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchGitFileDiff, runProjectAction } from "../../api/projects";
import { ActionButton } from "../shared/ActionButton";
import { EmptyPanel } from "../shared/EmptyPanel";
import { LoadingPanel } from "../shared/LoadingPanel";
import type { CommandResult } from "../../types/common";
import type { GitDetails, GitFileChange, GitFileDiff, GitFileStatus, GitStashEntry } from "../../types/git";
import { commandErrorResult } from "../../utils/commandResult";
import { formatDate } from "../../utils/projects";

const GIT_FILE_ROW_HEIGHT = 41;
const GIT_FILE_LIST_MAX_HEIGHT = 230;
const GIT_FILE_LIST_OVERSCAN = 1;

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
  const stagedFiles = React.useMemo(() => files?.staged ?? [], [files?.staged]);
  const unstagedFiles = React.useMemo(() => files?.unstaged ?? [], [files?.unstaged]);
  const stagedCount = stagedFiles.length;
  const unstagedCount = unstagedFiles.length;
  const totalChanges = stagedCount + unstagedCount;
  const canSync = Boolean(details?.status.tracking);
  const [selectedChange, setSelectedChange] = React.useState<{ file: GitFileChange; staged: boolean } | null>(null);
  const selectedKey = selectedChange ? getChangeKey(selectedChange.file, selectedChange.staged) : null;

  React.useEffect(() => {
    const allChanges = [
      ...stagedFiles.map((file) => ({ file, staged: true })),
      ...unstagedFiles.map((file) => ({ file, staged: false }))
    ];
    if (selectedKey && allChanges.some((change) => getChangeKey(change.file, change.staged) === selectedKey)) return;
    setSelectedChange(allChanges[0] ?? null);
  }, [files, selectedKey, stagedFiles, unstagedFiles]);

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
    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ px: 0.25 }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">Working tree</Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 0.35 }}>
            <Chip
              size="small"
              color={details.status.isClean ? "success" : "warning"}
              label={details.status.isClean ? "working tree pulito" : `${totalChanges} modifiche`}
            />
            <Chip size="small" label={`${stagedCount} staged`} variant="outlined" />
            <Chip size="small" label={`${unstagedCount} unstaged`} variant="outlined" />
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Chip size="small" label={details.status.current} color="primary" variant="outlined" />
          {details.status.tracking ? <Chip size="small" label={details.status.tracking} variant="outlined" /> : null}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(250px, 300px) minmax(320px, 1fr) minmax(280px, 320px)"
          },
          gridTemplateAreas: {
            xs: '"files" "diff" "actions"',
            lg: '"files diff actions"'
          },
          gap: 1,
          alignItems: "start",
          minWidth: 0
        }}
      >
        <Stack spacing={1} sx={{ minWidth: 0, gridArea: "files" }}>
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
            staged
            selectedKey={selectedKey}
            onSelect={(file) => setSelectedChange({ file, staged: true })}
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
            staged={false}
            selectedKey={selectedKey}
            onSelect={(file) => setSelectedChange({ file, staged: false })}
            onResult={onResult}
            onCompleted={onCompleted}
          />
        </Stack>

        <Box sx={{ minWidth: 0, gridArea: "diff" }}>
          <GitDiffPanel projectId={projectId} selectedChange={selectedChange} />
        </Box>

        <Stack spacing={1} sx={{ minWidth: 0, gridArea: "actions" }}>
          <GitActionBlock title="Commit">
            <Stack spacing={1}>
              <CommitSummary details={details} />
              <Box
                sx={{
                  px: 1,
                  py: 0.8,
                  borderLeft: "2px solid",
                  borderColor: stagedCount > 0 ? "primary.main" : "divider",
                  bgcolor: "var(--rc-surface-2)"
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Crea un commit su <Box component="span" sx={{ color: "text.primary", fontFamily: "var(--rc-font-mono)" }}>{details.status.current}</Box>
                  {` con ${stagedCount} file; ${unstagedCount} resteranno fuori dal commit.`}
                </Typography>
              </Box>
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
  staged: boolean;
  selectedKey: string | null;
  onSelect: (file: GitFileChange) => void;
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
  staged,
  selectedKey,
  onSelect,
  onResult,
  onCompleted
}: GitFileSectionProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--rc-radius-panel)",
        overflow: "hidden",
        minWidth: 0
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 0.75, minHeight: 38, borderBottom: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-2)" }}
      >
        <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
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

      <Box>
        {files.length > 0 ? (
          <GitFileList
            projectId={projectId}
            title={title}
            files={files}
            actionPath={fileActionPath}
            actionLabel={fileActionLabel}
            actionIcon={fileActionIcon}
            staged={staged}
            selectedKey={selectedKey}
            onSelect={onSelect}
            onResult={onResult}
            onCompleted={onCompleted}
          />
        ) : (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ px: 1.25, py: 1.5 }}>
            {emptyLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

type GitFileListProps = {
  projectId: string;
  title: string;
  files: GitFileChange[];
  actionPath: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  staged: boolean;
  selectedKey: string | null;
  onSelect: (file: GitFileChange) => void;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function GitFileList({
  projectId,
  title,
  files,
  actionPath,
  actionLabel,
  actionIcon,
  staged,
  selectedKey,
  onSelect,
  onResult,
  onCompleted
}: GitFileListProps) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const pendingScrollTopRef = React.useRef(0);
  const animationFrameRef = React.useRef<number | null>(null);
  const totalHeight = files.length * GIT_FILE_ROW_HEIGHT;
  const viewportHeight = Math.min(totalHeight, GIT_FILE_LIST_MAX_HEIGHT);
  const effectiveScrollTop = Math.min(scrollTop, Math.max(0, totalHeight - viewportHeight));
  const startIndex = Math.max(0, Math.floor(effectiveScrollTop / GIT_FILE_ROW_HEIGHT) - GIT_FILE_LIST_OVERSCAN);
  const endIndex = Math.min(
    files.length,
    Math.ceil((effectiveScrollTop + viewportHeight) / GIT_FILE_ROW_HEIGHT) + GIT_FILE_LIST_OVERSCAN
  );

  React.useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    pendingScrollTopRef.current = event.currentTarget.scrollTop;

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setScrollTop(pendingScrollTopRef.current);
    });
  }

  return (
    <Box
      onScroll={handleScroll}
      sx={{ position: "relative", height: viewportHeight, maxHeight: GIT_FILE_LIST_MAX_HEIGHT, overflowY: "auto" }}
    >
      <Box sx={{ position: "relative", height: totalHeight }}>
        {files.slice(startIndex, endIndex).map((file, visibleIndex) => {
          const fileIndex = startIndex + visibleIndex;

          return (
            <Box
              key={`${title}-${file.previousPath ?? ""}-${file.path}-${file.status}`}
              sx={{ position: "absolute", inset: `${fileIndex * GIT_FILE_ROW_HEIGHT}px 0 auto`, height: GIT_FILE_ROW_HEIGHT }}
            >
              <GitFileRow
                projectId={projectId}
                file={file}
                actionPath={actionPath}
                actionLabel={actionLabel}
                actionIcon={actionIcon}
                selected={getChangeKey(file, staged) === selectedKey}
                onSelect={onSelect}
                onResult={onResult}
                onCompleted={onCompleted}
              />
            </Box>
          );
        })}
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
  selected: boolean;
  onSelect: (file: GitFileChange) => void;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

const GitFileRow = React.memo(function GitFileRow({
  projectId,
  file,
  actionPath,
  actionLabel,
  actionIcon,
  selected,
  onSelect,
  onResult,
  onCompleted
}: GitFileRowProps) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(file)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(file);
        }
      }}
      sx={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto 34px",
        gap: 0.75,
        alignItems: "center",
        height: GIT_FILE_ROW_HEIGHT,
        px: 1.25,
        py: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        bgcolor: selected ? "action.selected" : "transparent",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "7px auto 7px 0",
          width: 2,
          borderRadius: 1,
          bgcolor: "primary.main",
          transform: selected ? "scaleY(1)" : "scaleY(0)",
          transition: "transform var(--rc-motion-fast) ease"
        },
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outline: "3px solid", outlineColor: "action.focus", outlineOffset: -3 }
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
});

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

  async function runAction(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
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

function CommitSummary({ details }: { details: GitDetails }) {
  const summary = details.status.diff.staged;
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      <Chip size="small" label={`${summary.files} file`} variant="outlined" />
      <Chip size="small" label={`+${summary.additions}`} color="success" variant="outlined" />
      <Chip size="small" label={`−${summary.deletions}`} color="error" variant="outlined" />
      {summary.binaryFiles > 0 ? <Chip size="small" label={`${summary.binaryFiles} binari`} variant="outlined" /> : null}
    </Stack>
  );
}

function GitDiffPanel({
  projectId,
  selectedChange
}: {
  projectId: string;
  selectedChange: { file: GitFileChange; staged: boolean } | null;
}) {
  const diffQuery = useQuery({
    queryKey: ["git-file-diff", projectId, selectedChange?.file.previousPath, selectedChange?.file.path, selectedChange?.staged],
    queryFn: () => fetchGitFileDiff(projectId, selectedChange!.file, selectedChange!.staged),
    enabled: Boolean(selectedChange)
  });

  return (
    <Box sx={{ position: { lg: "sticky" }, top: { lg: 0 }, minWidth: 0 }}>
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "var(--rc-radius-panel)", overflow: "hidden" }}>
        <Stack direction="row" alignItems="center" sx={{ minHeight: 42, px: 1.25, py: 0.75, borderBottom: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-2)" }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500, fontFamily: selectedChange ? "var(--rc-font-mono)" : undefined }}>
              {selectedChange ? getGitFileDisplayPath(selectedChange.file) : "Diff"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedChange ? (selectedChange.staged ? "Modifiche staged" : "Modifiche working tree") : "Seleziona un file"}
            </Typography>
          </Box>
          {diffQuery.data ? (
            <Stack direction="row" spacing={0.5}>
              <Chip size="small" label={`+${diffQuery.data.additions}`} color="success" variant="outlined" />
              <Chip size="small" label={`−${diffQuery.data.deletions}`} color="error" variant="outlined" />
            </Stack>
          ) : null}
        </Stack>
        <DiffContent diff={diffQuery.data} isLoading={diffQuery.isFetching} error={diffQuery.error} />
      </Box>
    </Box>
  );
}

function DiffContent({ diff, isLoading, error }: { diff: GitFileDiff | undefined; isLoading: boolean; error: Error | null }) {
  if (isLoading && !diff) {
    return <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}><CircularProgress size={16} /><Typography variant="body2">Caricamento diff</Typography></Stack>;
  }
  if (error) return <Typography variant="body2" color="error" sx={{ p: 2 }}>{error.message}</Typography>;
  if (!diff) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Seleziona un file per ispezionare le modifiche.</Typography>;
  if (diff.binary) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>File binario: anteprima testuale non disponibile.</Typography>;
  if (!diff.patch) return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nessuna differenza testuale disponibile.</Typography>;

  return (
    <Box
      sx={{
        maxHeight: { xs: 440, lg: "calc(100dvh - 286px)" },
        minHeight: 280,
        overflow: "auto",
        bgcolor: "#141622",
        color: "#cfd3e5",
        fontFamily: "var(--rc-font-mono)",
        fontSize: 11.5,
        lineHeight: 1.65
      }}
    >
      {diff.patch.split("\n").map((line, index) => (
        <Box
          key={`${index}-${line.slice(0, 24)}`}
          component="div"
          sx={{
            px: 1.25,
            minWidth: "max-content",
            whiteSpace: "pre",
            color: getDiffLineColor(line),
            bgcolor: getDiffLineBackground(line)
          }}
        >
          {line || " "}
        </Box>
      ))}
    </Box>
  );
}

function getDiffLineColor(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "#99dec3";
  if (line.startsWith("-") && !line.startsWith("---")) return "#f2a695";
  if (line.startsWith("@@")) return "#a2d1ed";
  return "#cfd3e5";
}

function getDiffLineBackground(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "rgba(108, 194, 161, 0.10)";
  if (line.startsWith("-") && !line.startsWith("---")) return "rgba(224, 131, 111, 0.10)";
  if (line.startsWith("@@")) return "rgba(116, 179, 217, 0.08)";
  return "transparent";
}

function getChangeKey(file: GitFileChange, staged: boolean): string {
  return `${staged ? "staged" : "unstaged"}:${file.previousPath ?? ""}:${file.path}`;
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
        borderRadius: "var(--rc-radius-panel)",
        p: 1.25,
        minWidth: 0
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
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
