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
import type { ProjectSummary } from "../../types";
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
      onOpenProject(project.id);
      onClose();
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
      aria-label="Repository command palette"
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          mt: 10,
          alignSelf: "flex-start",
          overflow: "hidden"
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
              fontSize: "1rem",
              borderBottom: "1px solid",
              borderColor: "divider"
            }
          }}
        />

        {results.length > 0 ? (
          <List disablePadding sx={{ py: 0.75, maxHeight: 430, overflow: "auto" }}>
            {results.map((project, index) => (
              <ListItemButton
                key={project.id}
                selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onOpenProject(project.id);
                  onClose();
                }}
                sx={{ mx: 0.75, borderRadius: 1, alignItems: "flex-start", gap: 1 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
                        {project.name}
                      </Typography>
                      <Chip size="small" variant="outlined" label={project.branch} />
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" noWrap component="span">
                      {project.path}
                    </Typography>
                  }
                />
                <ProjectSignal project={project} />
              </ListItemButton>
            ))}
          </List>
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

type ProjectSignalProps = {
  project: ProjectSummary;
};

function ProjectSignal({ project }: ProjectSignalProps) {
  if (!project.isClean) {
    return <Chip size="small" color="warning" label="dirty" />;
  }

  if (project.behind > 0) {
    return <Chip size="small" color="secondary" label={`behind ${project.behind}`} />;
  }

  if (project.ahead > 0) {
    return <Chip size="small" color="info" label={`ahead ${project.ahead}`} />;
  }

  return <Chip size="small" color="success" label="clean" />;
}
