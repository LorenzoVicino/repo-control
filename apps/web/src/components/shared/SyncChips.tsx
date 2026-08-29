import { Chip, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";

type SyncChipsProps = {
  project: ProjectSummary;
};

export function SyncChips({ project }: SyncChipsProps) {
  const { t } = useTranslation();

  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {project.upstream ? (
        <Chip size="small" variant="outlined" label={project.upstream} />
      ) : (
        <Chip size="small" variant="outlined" label={t("shared.noUpstream")} />
      )}
      {project.ahead > 0
        ? <Chip size="small" color="info" label={t("shared.ahead", { total: project.ahead })} />
        : null}
      {project.behind > 0
        ? <Chip size="small" color="error" variant="outlined" label={t("shared.behind", { total: project.behind })} />
        : null}
    </Stack>
  );
}
