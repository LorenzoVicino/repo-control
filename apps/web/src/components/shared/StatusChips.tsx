import { Chip, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";

type StatusChipsProps = {
  project: ProjectSummary;
};

export function StatusChips({ project }: StatusChipsProps) {
  const { t } = useTranslation();

  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      <Chip
        size="small"
        color={project.isClean ? "success" : "warning"}
        label={project.isClean ? t("shared.clean") : t("shared.modified")}
        variant="outlined"
      />
      {project.staged > 0
        ? <Chip size="small" label={t("shared.stagedCount", { total: project.staged })} />
        : null}
      {project.modified > 0
        ? <Chip size="small" label={t("shared.modifiedCount", { total: project.modified })} />
        : null}
      {project.untracked > 0
        ? <Chip size="small" label={t("shared.untrackedCount", { total: project.untracked })} />
        : null}
    </Stack>
  );
}
