import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import React from "react";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../../types/projects";
import { formatRelativeTime } from "../../../utils/time";
import { getLocalChangeCount, getProjectStateTone, getResumeProjects } from "../dashboardInsights";
import { StateDot, WidgetBody, WidgetEmpty, WidgetFigure, WidgetHeader, WidgetRow, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

const LIMIT = { small: 4, medium: 5, large: 10 } as const;

export function ResumeWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const entries = React.useMemo(
    () => getResumeProjects(context.projects, context.recentProjectIds, context.favoriteProjectIds, LIMIT[size]),
    [context.favoriteProjectIds, context.projects, context.recentProjectIds, size]
  );
  const recentCount = entries.filter((entry) => entry.source === "recent").length;

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.resume.title")}
        meta={recentCount > 0 ? t("dashboard.widgets.resume.recentCount", { count: recentCount }) : undefined}
        action={context.projects.length > 0 ? { label: t("dashboard.widgets.resume.all"), onClick: () => context.onNavigate("repositories") } : undefined}
      />
      {entries.length === 0 ? (
        <WidgetEmpty
          icon={<HistoryRoundedIcon />}
          title={t("dashboard.widgets.resume.empty")}
          hint={t("dashboard.widgets.resume.emptyHint")}
          action={context.projects.length === 0 ? { label: t("dashboard.widgets.workspace.pickFolder"), onClick: context.onPickWorkspace } : undefined}
        />
      ) : (
        <WidgetBody columns={size === "large" ? 2 : 1}>
          {entries.map(({ project, source }) => (
            <WidgetRow
              key={project.id}
              onClick={() => context.onOpenProject(project.id)}
              ariaLabel={t("dashboard.widgets.resume.open", { name: project.name })}
              leading={source === "favorite"
                ? <StarRoundedIcon sx={{ fontSize: 14, color: "warning.main" }} titleAccess={t("dashboard.widgets.resume.sources.favorite")} />
                : <StateDot tone={getProjectStateTone(project)} />}
              primary={project.name}
              secondary={size === "small" ? undefined : (
                <>
                  <span style={{ fontFamily: "var(--rc-font-mono)" }}>{project.branch}</span>
                  {project.lastCommit ? ` · ${t("dashboard.widgets.resume.lastCommit", { time: formatRelativeTime(project.lastCommit.date, language) ?? "" })}` : ""}
                </>
              )}
              trailing={<ProjectStateFigure project={project} />}
            />
          ))}
        </WidgetBody>
      )}
    </>
  );
}

// A repository's working state in one short mono figure, coloured like the dot beside it.
export function ProjectStateFigure({ project }: { project: ProjectSummary }) {
  const { t } = useTranslation();
  const parts: string[] = [];
  if (!project.isClean) parts.push(t("dashboard.widgets.shared.changeCount", { count: getLocalChangeCount(project) }));
  if (project.behind > 0) parts.push(`↓${project.behind}`);
  if (project.ahead > 0) parts.push(`↑${project.ahead}`);
  const tone = project.isClean && project.behind === 0 && project.ahead === 0 ? undefined : getProjectStateTone(project);

  return <WidgetFigure tone={tone}>{parts.length > 0 ? parts.join(" ") : t("dashboard.widgets.shared.clean")}</WidgetFigure>;
}
