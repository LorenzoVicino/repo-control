import { Box, Chip, Paper, Stack, Typography, useTheme } from "@mui/material";
import type { ProjectSummary } from "../../types";
import { getProjectTone, groupProjects } from "../../utils/projects";

type WorkspaceMapProps = {
  root: string;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
};

export function WorkspaceMap({ root, projects, onSelectProject }: WorkspaceMapProps) {
  const groups = groupProjects(projects, root);

  if (projects.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography>No Git repositories found.</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      {groups.map((group) => (
        <Box key={group.label}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
            <Typography variant="h2">{group.label}</Typography>
            <Chip size="small" label={group.projects.length} variant="outlined" />
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))"
              },
              gap: 1.5
            }}
          >
            {group.projects.map((project) => (
              <ProjectNode key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

type ProjectNodeProps = {
  project: ProjectSummary;
  onClick: () => void;
};

function ProjectNode({ project, onClick }: ProjectNodeProps) {
  const theme = useTheme();
  const tone = getProjectTone(project, theme.palette.mode);

  return (
    <Paper
      component="button"
      type="button"
      variant="outlined"
      onClick={onClick}
      sx={{
        minHeight: 150,
        width: "100%",
        p: 1.5,
        textAlign: "left",
        borderLeft: `5px solid ${tone.borderColor}`,
        background: tone.background,
        cursor: "pointer",
        transition: "border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
        "&:hover": {
          boxShadow:
            theme.palette.mode === "light"
              ? "0 8px 24px rgba(15, 23, 42, 0.12)"
              : "0 8px 24px rgba(0, 0, 0, 0.42)",
          transform: "translateY(-1px)"
        }
      }}
    >
      <Stack spacing={1} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
              {project.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {project.branch}
            </Typography>
          </Box>
          <Chip size="small" color={tone.chipColor} label={tone.label} />
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {project.upstream ? <Chip size="small" variant="outlined" label={project.upstream} /> : null}
          {project.ahead > 0 ? <Chip size="small" color="info" label={`ahead ${project.ahead}`} /> : null}
          {project.behind > 0 ? <Chip size="small" color="secondary" label={`behind ${project.behind}`} /> : null}
          {project.hasDockerCompose ? <Chip size="small" label="compose" /> : null}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {project.lastCommit ? `${project.lastCommit.hash} - ${project.lastCommit.message}` : "No commits"}
        </Typography>
      </Stack>
    </Paper>
  );
}
