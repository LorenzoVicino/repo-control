import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import type { ProjectSummary } from "../../types";
import { getProjectTone, groupProjects } from "../../utils/projects";

type WorkspaceMapProps = {
  root: string;
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

export function WorkspaceMap({
  root,
  projects,
  favoriteProjectIds,
  onSelectProject,
  onToggleFavorite
}: WorkspaceMapProps) {
  const groups = groupProjects(projects, root);

  if (projects.length === 0) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: "center",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Typography>No Git repositories found.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      {groups.map((group) => (
        <Box key={group.label}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
            <Typography variant="h2">{group.label}</Typography>
            <Chip size="small" label={group.projects.length} variant="outlined" />
          </Stack>
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: "divider",
              pt: 1.25
            }}
          >
            <ProjectCardGrid>
              {group.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isFavorite={favoriteProjectIds.includes(project.id)}
                  onClick={() => onSelectProject(project.id)}
                  onToggleFavorite={() => onToggleFavorite(project.id)}
                />
              ))}
            </ProjectCardGrid>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

type FavoriteProjectsProps = {
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

export function FavoriteProjects({
  projects,
  favoriteProjectIds,
  onSelectProject,
  onToggleFavorite
}: FavoriteProjectsProps) {
  const favoriteProjects = projects.filter((project) => favoriteProjectIds.includes(project.id));

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <Typography variant="h2">Preferiti</Typography>
        <Chip size="small" label={favoriteProjects.length} variant="outlined" />
      </Stack>

      {favoriteProjects.length > 0 ? (
        <ProjectCardGrid>
          {favoriteProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isFavorite
              onClick={() => onSelectProject(project.id)}
              onToggleFavorite={() => onToggleFavorite(project.id)}
            />
          ))}
        </ProjectCardGrid>
      ) : (
        <Box
          sx={{
            p: 2,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1,
            color: "text.secondary"
          }}
        >
          <Typography variant="body2">Nessun repository preferito.</Typography>
        </Box>
      )}
    </Box>
  );
}

type ProjectCardGridProps = {
  children: ReactNode;
};

function ProjectCardGrid({ children }: ProjectCardGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(3, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))"
        },
        gap: 1.25
      }}
    >
      {children}
    </Box>
  );
}

type ProjectCardProps = {
  project: ProjectSummary;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
};

function ProjectCard({ project, isFavorite, onClick, onToggleFavorite }: ProjectCardProps) {
  const theme = useTheme();
  const tone = getProjectTone(project, theme.palette.mode);
  const localChanges = project.modified + project.staged + project.untracked;

  return (
    <Paper
      role="button"
      tabIndex={0}
      aria-label={`Apri ${project.name}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        minHeight: 132,
        width: "100%",
        p: 1.5,
        textAlign: "left",
        border: "1px solid",
        borderColor: "divider",
        borderLeft: `3px solid ${tone.borderColor}`,
        bgcolor: "background.paper",
        cursor: "pointer",
        transition: "border-color 120ms ease, background-color 120ms ease",
        "&:hover": {
          borderColor: tone.borderColor,
          bgcolor: theme.palette.action.hover
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: -2
        }
      }}
    >
      <Stack spacing={1} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
              {project.name}
            </Typography>
          </Box>
          <Tooltip title={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}>
            <IconButton
              size="small"
              color={isFavorite ? "warning" : "default"}
              aria-label={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              {isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip size="small" variant="outlined" label={project.branch} />
          {project.ahead > 0 ? <Chip size="small" color="info" label={`+${project.ahead}`} /> : null}
          {project.behind > 0 ? <Chip size="small" color="secondary" label={`-${project.behind}`} /> : null}
          {localChanges > 0 ? <Chip size="small" color="warning" label={`changes ${localChanges}`} /> : null}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {project.lastCommit ? project.lastCommit.message : "No commits"}
          </Typography>
          {project.lastCommit ? (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {project.lastCommit.author}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}
