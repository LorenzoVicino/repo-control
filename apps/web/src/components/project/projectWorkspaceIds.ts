export function getProjectPanelId(projectId: string): string {
  return `project-workspace-panel-${encodeURIComponent(projectId)}`;
}

export function getProjectTabId(projectId: string): string {
  return `project-workspace-tab-${encodeURIComponent(projectId)}`;
}
