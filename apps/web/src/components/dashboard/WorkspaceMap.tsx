import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { alpha, Box, ButtonBase, Chip, Collapse, IconButton, Paper, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import React, { type ReactNode } from "react";
import type { ProjectSummary } from "../../types/projects";
import { formatDate, getProjectTone, groupProjects } from "../../utils/projects";

type WorkspaceMapProps = {
  root: string;
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

export const WorkspaceMap = React.memo(function WorkspaceMap({
  root,
  projects,
  favoriteProjectIds,
  onSelectProject,
  onToggleFavorite
}: WorkspaceMapProps) {
  const groups = React.useMemo(() => groupProjects(projects, root), [projects, root]);
  const favoriteProjectIdSet = React.useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const [, startGroupTransition] = React.useTransition();
  const [collapsedGroupLabels, setCollapsedGroupLabels] = React.useState<Set<string>>(() => new Set());

  if (projects.length === 0) {
    return <WorkspaceEmptyState />;
  }

  return (
    <Stack spacing={2.5}>
      {groups.map((group) => {
        const isExpanded = !collapsedGroupLabels.has(group.label);

        return (
          <CollapsibleProjectSection
            key={group.label}
            id={`project-group-${group.label}`}
            title={group.label}
            count={group.projects.length}
            isExpanded={isExpanded}
            onToggle={() => {
              startGroupTransition(() => {
                setCollapsedGroupLabels((currentLabels) => {
                  const nextLabels = new Set(currentLabels);

                  if (nextLabels.has(group.label)) {
                    nextLabels.delete(group.label);
                  } else {
                    nextLabels.add(group.label);
                  }

                  return nextLabels;
                });
              });
            }}
          >
            <ProjectCardGrid>
              {group.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isFavorite={favoriteProjectIdSet.has(project.id)}
                  onSelectProject={onSelectProject}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </ProjectCardGrid>
          </CollapsibleProjectSection>
        );
      })}
    </Stack>
  );
});

type FavoriteProjectsProps = {
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

export const FavoriteProjects = React.memo(function FavoriteProjects({
  projects,
  favoriteProjectIds,
  onSelectProject,
  onToggleFavorite
}: FavoriteProjectsProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const favoriteProjectIdSet = React.useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const favoriteProjects = React.useMemo(
    () => projects.filter((project) => favoriteProjectIdSet.has(project.id)),
    [favoriteProjectIdSet, projects]
  );

  if (favoriteProjects.length === 0) {
    return null;
  }

  return (
    <Box component="section" aria-label="Repository preferiti">
      <CollapsibleProjectSection
        id="favorite-projects"
        title="Preferiti"
        titleComponent="h1"
        count={favoriteProjects.length}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((currentValue) => !currentValue)}
      >
        <ProjectCardGrid>
          {favoriteProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isFavorite
              onSelectProject={onSelectProject}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </ProjectCardGrid>
      </CollapsibleProjectSection>
    </Box>
  );
});

type CollapsibleProjectSectionProps = {
  id: string;
  title: string;
  titleComponent?: "h1" | "h2";
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function CollapsibleProjectSection({
  id,
  title,
  titleComponent = "h2",
  count,
  isExpanded,
  onToggle,
  children
}: CollapsibleProjectSectionProps) {
  return (
    <Box>
      <Box
        component="button"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={id}
        onClick={onToggle}
        sx={{
          width: "100%",
          p: 0,
          mb: isExpanded ? 1.25 : 0,
          display: "flex",
          alignItems: "center",
          gap: 0.9,
          color: "text.primary",
          bgcolor: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          "&:hover .section-title": { color: "primary.main" },
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: (theme) => alpha(theme.palette.primary.main, 0.24),
            outlineOffset: 4,
            borderRadius: 1
          }
        }}
      >
        <FolderOutlinedIcon sx={{ fontSize: 19, color: "secondary.main" }} />
        <Typography
          className="section-title"
          component={titleComponent}
          variant={titleComponent === "h1" ? "h1" : "h2"}
          sx={{ transition: "color 160ms ease" }}
        >
          {title}
        </Typography>
        <Chip size="small" label={count} variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      <Collapse in={isExpanded} timeout={180} unmountOnExit>
        <Box id={id}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function ProjectCardGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
          xl: "repeat(5, minmax(0, 1fr))"
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
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

const ProjectCard = React.memo(function ProjectCard({
  project,
  isFavorite,
  onSelectProject,
  onToggleFavorite
}: ProjectCardProps) {
  const theme = useTheme();
  const tone = getProjectTone(project, theme.palette.mode);
  const localChanges = project.modified + project.staged + project.untracked;

  return (
    <Paper
      component="article"
      sx={{
        position: "relative",
        minHeight: 168,
        width: "100%",
        p: 1.5,
        overflow: "hidden",
        textAlign: "left",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        cursor: "pointer",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 168px",
        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 0 auto 0",
          height: 3,
          bgcolor: tone.borderColor
        },
        "&:hover": {
          borderColor: alpha(tone.borderColor, 0.55),
          transform: "translateY(-2px)",
          boxShadow: `0 12px 26px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.075 : 0.22)}`
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover": { transform: "none" }
        }
      }}
    >
      <ButtonBase
        aria-label={`Apri ${project.name}`}
        onClick={() => onSelectProject(project.id)}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          borderRadius: "inherit",
          "&.Mui-focusVisible": {
            outline: "3px solid",
            outlineColor: alpha(theme.palette.primary.main, 0.3),
            outlineOffset: -3
          }
        }}
      />
      <Stack spacing={1.1} sx={{ position: "relative", height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1,
              color: tone.borderColor,
              bgcolor: alpha(tone.borderColor, 0.1)
            }}
          >
            <AccountTreeIcon sx={{ fontSize: 19 }} />
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 750 }} noWrap>
              {project.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {getStatusLabel(project)}
            </Typography>
          </Box>
          <Tooltip title={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}>
            <IconButton
              size="small"
              color={isFavorite ? "warning" : "default"}
              aria-label={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite(project.id);
              }}
              sx={{ position: "relative", zIndex: 2, mr: -0.5 }}
            >
              {isFavorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
          <Chip size="small" variant="outlined" icon={<CallSplitIcon />} label={project.branch} />
          {project.ahead > 0 ? <Chip size="small" color="info" label={`+${project.ahead} ahead`} /> : null}
          {project.behind > 0 ? <Chip size="small" color="error" variant="outlined" label={`${project.behind} behind`} /> : null}
          {localChanges > 0 ? <Chip size="small" color="warning" variant="outlined" label={`${localChanges} modifiche`} /> : null}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ minWidth: 0, pt: 0.9, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.primary" noWrap component="div" sx={{ fontWeight: 600 }}>
            {project.lastCommit ? project.lastCommit.message : "Nessun commit"}
          </Typography>
          {project.lastCommit ? (
            <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ mt: 0.2 }}>
              {project.lastCommit.author} · {formatDate(project.lastCommit.date)}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
});

function WorkspaceEmptyState() {
  return (
    <Box
      sx={{
        minHeight: 240,
        display: "grid",
        placeItems: "center",
        p: 4,
        textAlign: "center",
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper"
      }}
    >
      <Stack spacing={1} alignItems="center">
        <AccountTreeIcon color="disabled" sx={{ fontSize: 32 }} />
        <Typography variant="h6">Nessun repository trovato</Typography>
        <Typography variant="body2" color="text.secondary">
          Cambia workspace oppure modifica la ricerca corrente.
        </Typography>
      </Stack>
    </Box>
  );
}

function getStatusLabel(project: ProjectSummary): string {
  if (!project.isClean) {
    return "Modifiche locali";
  }

  if (project.behind > 0) {
    return "Aggiornamento remoto disponibile";
  }

  if (project.ahead > 0) {
    return "Commit locali da pubblicare";
  }

  return "Sincronizzato e pulito";
}
