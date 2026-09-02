import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type { DockerContainerGroup } from "../../../types/docker";
import { InlineBar } from "../DashboardCharts";
import { getContainerHealth } from "../dashboardInsights";
import { StateDot, WidgetBody, WidgetEmpty, WidgetFigure, WidgetHeader, WidgetRow, WidgetRowsSkeleton, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

const GROUP_LIMIT = { small: 3, medium: 6, large: 6 } as const;

export function RuntimeWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dockerStatus = context.dockerStatus;
  const groups = React.useMemo(() => (dockerStatus?.ok ? sortGroups(dockerStatus.groups) : []), [dockerStatus]);
  const health = React.useMemo(() => {
    const result = { healthy: 0, unhealthy: 0, restarting: 0 };
    for (const container of dockerStatus?.ok ? dockerStatus.containers : []) {
      const state = getContainerHealth(container);
      if (state === "unhealthy") result.unhealthy += 1;
      else if (state === "restarting") result.restarting += 1;
      else result.healthy += 1;
    }
    return result;
  }, [dockerStatus]);
  const projectsByPath = React.useMemo(
    () => new Map(context.projects.map((project) => [normalizePath(project.path), project])),
    [context.projects]
  );

  function openGroup(group: DockerContainerGroup) {
    const project = group.workingDir ? projectsByPath.get(normalizePath(group.workingDir)) : undefined;
    if (project) context.onOpenProject(project.id);
    else context.onNavigate("docker");
  }

  const isAvailable = dockerStatus?.ok === true;
  const maxGroupSize = Math.max(1, ...groups.map((group) => group.containers.length));

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.runtime.title")}
        meta={isAvailable ? t("dashboard.widgets.runtime.groupCount", { count: dockerStatus.groups.length }) : undefined}
        action={isAvailable ? { label: t("dashboard.widgets.runtime.open"), onClick: () => context.onNavigate("docker") } : undefined}
      />
      {!dockerStatus && context.isLoadingDocker ? (
        <WidgetRowsSkeleton rows={2} label={t("dashboard.widgets.runtime.loading")} />
      ) : !isAvailable ? (
        <WidgetEmpty
          icon={<Inventory2OutlinedIcon />}
          title={t("dashboard.widgets.runtime.unavailable")}
          hint={dockerStatus?.error ?? t("dashboard.widgets.runtime.unavailableHint")}
        />
      ) : dockerStatus.containers.length === 0 ? (
        <WidgetEmpty
          icon={<Inventory2OutlinedIcon />}
          title={t("dashboard.widgets.runtime.none")}
          hint={t("dashboard.widgets.runtime.noneHint")}
        />
      ) : (
        <>
          <Box sx={{ px: 1.5, pt: 1.1, pb: 0.9, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {t("dashboard.widgets.runtime.running", { count: dockerStatus.containers.length })}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 0.4 }} useFlexGap flexWrap="wrap">
              <HealthFigure tone="success.main" label={t("dashboard.widgets.runtime.healthy", { count: health.healthy })} />
              {health.unhealthy > 0 ? <HealthFigure tone="error.main" label={t("dashboard.widgets.runtime.unhealthy", { count: health.unhealthy })} /> : null}
              {health.restarting > 0 ? <HealthFigure tone="warning.main" label={t("dashboard.widgets.runtime.restarting", { count: health.restarting })} /> : null}
            </Stack>
          </Box>
          <WidgetBody columns={size === "medium" ? 2 : 1}>
            {groups.slice(0, GROUP_LIMIT[size]).map((group) => {
              const unhealthy = group.containers.filter((container) => getContainerHealth(container) === "unhealthy").length;
              return (
                <WidgetRow
                  key={group.id}
                  minHeight={38}
                  onClick={() => openGroup(group)}
                  ariaLabel={t("dashboard.widgets.runtime.openGroup", { name: group.name })}
                  leading={<StateDot tone={unhealthy > 0 ? "error.main" : "success.main"} />}
                  primary={group.name}
                  trailing={(
                    <>
                      <InlineBar
                        max={maxGroupSize}
                        segments={[
                          { key: "healthy", value: group.containers.length - unhealthy, color: theme.palette.primary.main, label: t("dashboard.widgets.runtime.healthy", { count: group.containers.length - unhealthy }) },
                          { key: "unhealthy", value: unhealthy, color: theme.palette.error.main, label: t("dashboard.widgets.runtime.unhealthy", { count: unhealthy }) }
                        ]}
                      />
                      <WidgetFigure tone={unhealthy > 0 ? "error.main" : undefined}>
                        {unhealthy > 0
                          ? t("dashboard.widgets.runtime.unhealthy", { count: unhealthy })
                          : t("dashboard.widgets.runtime.containerCount", { count: group.containers.length })}
                      </WidgetFigure>
                    </>
                  )}
                />
              );
            })}
          </WidgetBody>
        </>
      )}
    </>
  );
}

function HealthFigure({ tone, label }: { tone: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <StateDot tone={tone} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

// Groups with something wrong come first, then the busiest.
function sortGroups(groups: DockerContainerGroup[]): DockerContainerGroup[] {
  return [...groups].sort((left, right) => {
    const leftUnhealthy = left.containers.filter((container) => getContainerHealth(container) === "unhealthy").length;
    const rightUnhealthy = right.containers.filter((container) => getContainerHealth(container) === "unhealthy").length;
    return rightUnhealthy - leftUnhealthy || right.containers.length - left.containers.length || left.name.localeCompare(right.name);
  });
}

function normalizePath(value: string): string {
  return value.replace(/[\\/]+$/, "").toLocaleLowerCase();
}
