import { Chip, Stack } from "@mui/material";
import type { ProjectSummary } from "../../types/projects";

type StatusChipsProps = {
  project: ProjectSummary;
};

export function StatusChips({ project }: StatusChipsProps) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      <Chip
        size="small"
        color={project.isClean ? "success" : "warning"}
        label={project.isClean ? "pulito" : "modificato"}
        variant="outlined"
      />
      {project.staged > 0 ? <Chip size="small" label={`${project.staged} staged`} /> : null}
      {project.modified > 0 ? <Chip size="small" label={`${project.modified} modificati`} /> : null}
      {project.untracked > 0 ? <Chip size="small" label={`${project.untracked} nuovi`} /> : null}
    </Stack>
  );
}
