import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import React from "react";
import type { ProjectSummary } from "../../types/projects";
import { filterProjects } from "../../utils/projects";

const MAX_RESULTS = 12;

type RepositoryCommandPaletteProps = {
  open: boolean;
  projects: ProjectSummary[];
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
};

export function RepositoryCommandPalette({
  open,
  projects,
  query,
  onQueryChange,
  onClose,
  onOpenProject
}: RepositoryCommandPaletteProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const results = React.useMemo(() => filterProjects(projects, query).slice(0, MAX_RESULTS), [projects, query]);

  React.useEffect(() => {
    if (open) {
      setActiveIndex(0);
    }
  }, [open, query]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimer = window.setTimeout(focusSearchInput, 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  function focusSearchInput() {
    const input = searchInputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function openActiveProject() {
    const project = results[activeIndex];

    if (project) {
      onClose();
      onOpenProject(project.id);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.min(currentIndex + 1, Math.max(results.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      openActiveProject();
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      transitionDuration={{ enter: 160, exit: 0 }}
      PaperProps={{
        "aria-label": "Repository command palette",
        sx: {
          width: "min(748px, calc(100vw - 24px))",
          mt: { xs: 2, sm: 9 },
          alignSelf: "flex-start",
          overflow: "hidden",
          borderRadius: 1.5
        }
      }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: "rgba(12, 13, 22, 0.66)",
            backdropFilter: "blur(7px)"
          }
        }
      }}
      TransitionProps={{
        onEntered: focusSearchInput
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          autoFocus
          inputRef={searchInputRef}
          fullWidth
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cerca repository (Ctrl+P)"
          variant="standard"
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start" sx={{ ml: 2 }}>
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            sx: {
              px: 0,
              py: 1.5,
              bgcolor: "var(--rc-surface-2)",
              fontSize: 13,
              borderBottom: "1px solid",
              borderColor: "divider"
            }
          }}
        />

        {results.length > 0 ? (
          <>
            <Stack direction="row" alignItems="center" sx={{ minHeight: 31, px: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="overline" color="text.secondary" sx={{ flexGrow: 1 }}>Repository</Typography>
              <Typography color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>{results.length} risultati</Typography>
            </Stack>
            <List disablePadding sx={{ p: 0.75, maxHeight: 430, overflow: "auto" }}>
            {results.map((project, index) => (
              <ListItemButton
                key={project.id}
                selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onClose();
                  onOpenProject(project.id);
                }}
                sx={{
                  minHeight: 52,
                  px: 1.25,
                  borderRadius: 0.75,
                  alignItems: "center",
                  gap: 1,
                  borderLeft: "3px solid transparent",
                  "&.Mui-selected": { borderLeftColor: "primary.main" }
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    borderRadius: 0.75,
                    color: "primary.main",
                    bgcolor: "action.selected"
                  }}
                >
                  <AccountTreeIcon sx={{ fontSize: 18 }} />
                </Box>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500, minWidth: 0 }}>
                        {project.name}
                      </Typography>
                      <Chip size="small" variant="outlined" label={project.branch} />
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" noWrap component="span" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>
                      {project.path}
                    </Typography>
                  }
                />
                <ProjectSignal project={project} />
              </ListItemButton>
            ))}
            </List>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minHeight: 34, px: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-2)" }}>
              <KeyHint keys="↑↓" label="naviga" />
              <KeyHint keys="↵" label="apri" />
              <KeyHint keys="esc" label="chiudi" />
            </Stack>
          </>
        ) : (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Nessun repository trovato
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyHint({ keys, label }: { keys: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.45} alignItems="center">
      <Box component="kbd" sx={{ px: 0.55, py: 0.1, border: "1px solid", borderColor: "divider", borderRadius: 0.5, fontFamily: "var(--rc-font-mono)", fontSize: 9 }}>{keys}</Box>
      <Typography color="text.secondary" sx={{ fontSize: 9.5 }}>{label}</Typography>
    </Stack>
  );
}

type ProjectSignalProps = {
  project: ProjectSummary;
};

function ProjectSignal({ project }: ProjectSignalProps) {
  if (!project.isClean) {
    return <Chip size="small" color="warning" label="modificato" />;
  }

  if (project.behind > 0) {
    return <Chip size="small" color="secondary" label={`behind ${project.behind}`} />;
  }

  if (project.ahead > 0) {
    return <Chip size="small" color="info" label={`ahead ${project.ahead}`} />;
  }

  return <Chip size="small" color="success" label="pulito" />;
}
