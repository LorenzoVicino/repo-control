export type DashboardWidgetSize = "small" | "medium" | "large";

// The wire shape of the saved dashboard layout. Widget ids are plain strings here because
// the server does not know the registry; `dashboardLayout.ts` validates them on read.
export type StoredDashboardLayout = {
  version: 1;
  widgets: Array<{ id: string; size: DashboardWidgetSize; hidden: boolean }>;
};

export type UserPreferences = {
  favoriteProjectIds: string[];
  recentProjectIds: string[];
  dashboard: StoredDashboardLayout | null;
};
