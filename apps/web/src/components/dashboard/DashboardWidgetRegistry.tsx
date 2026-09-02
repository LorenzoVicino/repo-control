import type React from "react";
import type { DashboardWidgetId } from "./dashboardLayout";
import type { DashboardWidgetProps } from "./DashboardWidgetPrimitives";
import { AttentionWidget } from "./widgets/AttentionWidget";
import { AutomationsWidget } from "./widgets/AutomationsWidget";
import { ChatsWidget } from "./widgets/ChatsWidget";
import { FavoritesWidget } from "./widgets/FavoritesWidget";
import { ResumeWidget } from "./widgets/ResumeWidget";
import { RuntimeWidget } from "./widgets/RuntimeWidget";
import { ShortcutsWidget } from "./widgets/ShortcutsWidget";
import { WorkspaceWidget } from "./widgets/WorkspaceWidget";

// Titles live in the i18n resources under `dashboard.widgets.<id>.title`; sizes and the
// default arrangement live in `dashboardLayout.ts`. This file only binds id to component.
export const DASHBOARD_WIDGETS: Record<DashboardWidgetId, React.ComponentType<DashboardWidgetProps>> = {
  attention: AttentionWidget,
  workspace: WorkspaceWidget,
  runtime: RuntimeWidget,
  resume: ResumeWidget,
  chats: ChatsWidget,
  automations: AutomationsWidget,
  shortcuts: ShortcutsWidget,
  favorites: FavoritesWidget
};
