import { Chip, Stack } from "@mui/material";
import type { ProjectSummary } from "../../types";

type SyncChipsProps = {
  project: ProjectSummary;
};

export function SyncChips({ project }: SyncChipsProps) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {project.upstream ? (
        <Chip size="small" variant="outlined" label={project.upstream} />
      ) : (
        <Chip size="small" variant="outlined" label="no upstream" />
      )}
      {project.ahead > 0 ? <Chip size="small" color="info" label={`ahead ${project.ahead}`} /> : null}
      {project.behind > 0 ? <Chip size="small" color="secondary" label={`behind ${project.behind}`} /> : null}
    </Stack>
  );
}
