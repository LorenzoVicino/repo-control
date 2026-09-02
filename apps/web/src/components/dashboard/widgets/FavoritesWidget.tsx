import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import React from "react";
import { useTranslation } from "react-i18next";
import { getProjectStateTone } from "../dashboardInsights";
import { StateDot, WidgetBody, WidgetEmpty, WidgetHeader, WidgetRow, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";
import { ProjectStateFigure } from "./ResumeWidget";

const LIMIT = { small: 4, medium: 5, large: 10 } as const;

export function FavoritesWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const favorites = React.useMemo(() => {
    const projectsById = new Map(context.projects.map((project) => [project.id, project]));
    return context.favoriteProjectIds.flatMap((projectId) => {
      const project = projectsById.get(projectId);
      return project ? [project] : [];
    });
  }, [context.favoriteProjectIds, context.projects]);

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.favorites.title")}
        meta={favorites.length > 0 ? t("dashboard.widgets.favorites.savedCount", { count: favorites.length }) : undefined}
        action={favorites.length > 0 ? { label: t("dashboard.widgets.favorites.all"), onClick: () => context.onNavigate("favorites") } : undefined}
      />
      {favorites.length === 0 ? (
        <WidgetEmpty
          icon={<StarBorderRoundedIcon />}
          title={t("dashboard.widgets.favorites.empty")}
          hint={t("dashboard.widgets.favorites.emptyHint")}
          action={{ label: t("dashboard.widgets.favorites.browse"), onClick: () => context.onNavigate("repositories") }}
        />
      ) : (
        <WidgetBody>
          {favorites.slice(0, LIMIT[size]).map((project) => (
            <WidgetRow
              key={project.id}
              onClick={() => context.onOpenProject(project.id)}
              ariaLabel={t("dashboard.widgets.resume.open", { name: project.name })}
              leading={<StateDot tone={getProjectStateTone(project)} />}
              primary={project.name}
              secondary={size === "small" ? undefined : <span style={{ fontFamily: "var(--rc-font-mono)" }}>{project.branch}</span>}
              trailing={<ProjectStateFigure project={project} />}
            />
          ))}
        </WidgetBody>
      )}
    </>
  );
}
