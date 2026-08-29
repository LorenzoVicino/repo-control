import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { alpha, Box, Button, ButtonBase, Chip, Collapse, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useTheme } from "@mui/material";
import React, { type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";
import { formatDate, getProjectAccentColor, groupProjects } from "../../utils/projects";

const EMPTY_PROJECT_IDS: string[] = [];

type WorkspaceMapProps = {
  root: string;
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  openProjectIds?: string[];
  density?: "compact" | "comfortable";
  groupBy?: "folder" | "status";
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

export const WorkspaceMap = React.memo(function WorkspaceMap({
  root,
  projects,
  favoriteProjectIds,
  openProjectIds = EMPTY_PROJECT_IDS,
  density = "comfortable",
  groupBy = "folder",
  onSelectProject,
  onToggleFavorite
}: WorkspaceMapProps) {
  const { t } = useTranslation();
  const groups = React.useMemo(
    () => groupBy === "folder" ? groupProjects(projects, root) : groupProjectsByStatus(t, projects),
    [groupBy, projects, root, t]
  );
  const favoriteProjectIdSet = React.useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const openProjectIdSet = React.useMemo(() => new Set(openProjectIds), [openProjectIds]);
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
                  isOpen={openProjectIdSet.has(project.id)}
                  density={density}
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
  openProjectIds?: string[];
  density: "compact" | "comfortable";
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
  onDensityChange: (density: "compact" | "comfortable") => void;
  onBrowseRepositories?: () => void;
};

export const FavoriteProjects = React.memo(function FavoriteProjects({
  projects,
  favoriteProjectIds,
  openProjectIds = EMPTY_PROJECT_IDS,
  density,
  onSelectProject,
  onToggleFavorite,
  onDensityChange,
  onBrowseRepositories
}: FavoriteProjectsProps) {
  const { t } = useTranslation();
  const favoriteProjectIdSet = React.useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const openProjectIdSet = React.useMemo(() => new Set(openProjectIds), [openProjectIds]);
  const favoriteProjects = React.useMemo(
    () => projects.filter((project) => favoriteProjectIdSet.has(project.id)),
    [favoriteProjectIdSet, projects]
  );

  return (
    <Box component="section" aria-label={t("dashboard.favorites.ariaLabel")}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-end" }} justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Box>
          <Typography component="h1" variant="h1">{t("dashboard.favorites.title")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t("dashboard.favorites.description")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            variant="outlined"
            label={t("dashboard.favorites.savedCount", { count: favoriteProjects.length })}
          />
          {favoriteProjects.length > 0 ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={density}
              onChange={(_, value: "compact" | "comfortable" | null) => {
                if (value) onDensityChange(value);
              }}
              aria-label={t("dashboard.favorites.densityAria")}
            >
              <ToggleButton value="compact" aria-label={t("dashboard.favorites.densityCompactAria")}>
                {t("dashboard.favorites.densityCompact")}
              </ToggleButton>
              <ToggleButton value="comfortable" aria-label={t("dashboard.favorites.densityComfortableAria")}>
                {t("dashboard.favorites.densityComfortable")}
              </ToggleButton>
            </ToggleButtonGroup>
          ) : null}
        </Stack>
      </Stack>

      {favoriteProjects.length === 0 ? (
        <Paper variant="outlined" sx={{ minHeight: 240, display: "grid", placeItems: "center", p: 3, borderStyle: "dashed", textAlign: "center" }}>
          <Stack spacing={1.25} alignItems="center" sx={{ maxWidth: 420 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", color: "warning.main", bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1) }}>
              <StarBorderIcon />
            </Box>
            <Typography variant="h3">{t("dashboard.favorites.emptyTitle")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.favorites.emptyDescription")}
            </Typography>
            {onBrowseRepositories ? (
              <Button variant="outlined" onClick={onBrowseRepositories}>
                {t("dashboard.favorites.browse")}
              </Button>
            ) : null}
          </Stack>
        </Paper>
      ) : (
        <ProjectCardGrid>
          {favoriteProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isFavorite
              isOpen={openProjectIdSet.has(project.id)}
              density={density}
              onSelectProject={onSelectProject}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </ProjectCardGrid>
      )}
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
  isOpen: boolean;
  density: "compact" | "comfortable";
  onSelectProject: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
};

const ProjectCard = React.memo(function ProjectCard({
  project,
  isFavorite,
  isOpen,
  density,
  onSelectProject,
  onToggleFavorite
}: ProjectCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accentColor = getProjectAccentColor(project);
  const localChanges = project.modified + project.staged + project.untracked;

  return (
    <Paper
      component="article"
      sx={{
        position: "relative",
        minHeight: density === "compact" ? 116 : 154,
        width: "100%",
        p: density === "compact" ? 1.1 : 1.5,
        overflow: "hidden",
        textAlign: "left",
        border: "1px solid",
        borderColor: isOpen ? "primary.main" : "divider",
        bgcolor: isOpen ? (theme) => alpha(theme.palette.primary.main, 0.04) : "background.paper",
        cursor: "pointer",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 168px",
        transition: "border-color var(--rc-motion-fast) ease, background-color var(--rc-motion-fast) ease",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "10px auto 10px 0",
          width: 2,
          bgcolor: accentColor
        },
        "&:hover": {
          borderColor: alpha(accentColor, 0.55),
          bgcolor: "var(--rc-surface-2)"
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
      <Stack spacing={density === "compact" ? 0.75 : 1.1} sx={{ position: "relative", height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1,
              color: accentColor,
              bgcolor: alpha(accentColor, 0.1)
            }}
          >
            <AccountTreeIcon sx={{ fontSize: 19 }} />
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 500 }} noWrap>
              {project.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {getStatusLabel(t, project)}
            </Typography>
          </Box>
          {isOpen ? <Chip size="small" color="primary" variant="outlined" label={t("dashboard.map.open")} /> : null}
          <Tooltip title={isFavorite ? t("dashboard.map.removeFavorite") : t("dashboard.map.addFavorite")}>
            <IconButton
              size="small"
              color={isFavorite ? "warning" : "default"}
              aria-label={isFavorite
                ? t("dashboard.map.removeFavoriteAria", { name: project.name })
                : t("dashboard.map.addFavoriteAria", { name: project.name })}
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
          {project.ahead > 0
            ? <Chip size="small" color="info" label={t("dashboard.map.aheadChip", { total: project.ahead })} />
            : null}
          {project.behind > 0
            ? <Chip
                size="small"
                color="error"
                variant="outlined"
                label={t("dashboard.map.behindChip", { total: project.behind })}
              />
            : null}
          {localChanges > 0
            ? <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t("dashboard.map.changesChip", { total: localChanges })}
              />
            : null}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ minWidth: 0, pt: density === "compact" ? 0.6 : 0.9, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.primary" noWrap component="div" sx={{ fontWeight: 600 }}>
            {project.lastCommit ? project.lastCommit.message : t("dashboard.map.noCommit")}
          </Typography>
          {project.lastCommit && density === "comfortable" ? (
            <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ mt: 0.2 }}>
              {project.lastCommit.author} · {formatDate(project.lastCommit.date, i18n.language)}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
});

function WorkspaceEmptyState() {
  const { t } = useTranslation();

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
        <Typography variant="h6">{t("dashboard.map.noRepositories")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("dashboard.map.changeWorkspace")}
        </Typography>
      </Stack>
    </Box>
  );
}

function getStatusLabel(t: TFunction, project: ProjectSummary): string {
  if (!project.isClean) {
    return t("dashboard.map.statusLocalChanges");
  }

  if (project.behind > 0) {
    return t("dashboard.map.statusBehind");
  }

  if (project.ahead > 0) {
    return t("dashboard.map.statusAhead");
  }

  return t("dashboard.map.statusClean");
}

function groupProjectsByStatus(t: TFunction, projects: ProjectSummary[]) {
  const groups = [
    {
      label: t("dashboard.map.groupAttention"),
      projects: projects.filter((project) => !project.isClean || project.behind > 0)
    },
    {
      label: t("dashboard.map.groupAhead"),
      projects: projects.filter((project) => project.isClean && project.behind === 0 && project.ahead > 0)
    },
    {
      label: t("dashboard.map.groupClean"),
      projects: projects.filter((project) => project.isClean && project.behind === 0 && project.ahead === 0)
    }
  ];
  return groups.filter((group) => group.projects.length > 0);
}
