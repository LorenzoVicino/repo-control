import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import TextFieldsOutlinedIcon from "@mui/icons-material/TextFieldsOutlined";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";
import type { SvgIconProps } from "@mui/material";
import type { TFunction } from "i18next";
import React from "react";
import type { WorkflowNode, WorkflowNodeType } from "../../types/workflows";

// Groups are stable identifiers, not display text: the visible name comes from
// `automation.groups.<group>` in the active locale.
export type AutomationNodeGroup =
  | "trigger"
  | "input"
  | "repository"
  | "git"
  | "docker"
  | "commands"
  | "output";

export type AutomationNodeDefinition = {
  type: WorkflowNodeType;
  group: AutomationNodeGroup;
  color: string;
  icon: React.ComponentType<SvgIconProps>;
  defaultConfig: Record<string, unknown>;
};

export const AUTOMATION_NODE_DEFINITIONS: AutomationNodeDefinition[] = [
  {
    type: "trigger.manual",
    group: "trigger",
    color: "#2563eb",
    icon: PlayArrowRoundedIcon,
    defaultConfig: {}
  },
  {
    type: "input.text",
    group: "input",
    color: "#db2777",
    icon: TextFieldsOutlinedIcon,
    defaultConfig: {
      key: "text",
      label: "",
      description: "",
      placeholder: "",
      defaultValue: "",
      required: true,
      multiline: false
    }
  },
  {
    type: "repository.select",
    group: "repository",
    color: "#0891b2",
    icon: AccountTreeOutlinedIcon,
    defaultConfig: { mode: "all", projectIds: [] }
  },
  {
    type: "repository.filter",
    group: "repository",
    color: "#0891b2",
    icon: FilterAltOutlinedIcon,
    defaultConfig: { clean: "any", sync: "any", docker: "any" }
  },
  {
    type: "git.fetch",
    group: "git",
    color: "#7c3aed",
    icon: CloudSyncOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "git.pull",
    group: "git",
    color: "#7c3aed",
    icon: DownloadOutlinedIcon,
    defaultConfig: { requireClean: true }
  },
  {
    type: "git.pullBranch",
    group: "git",
    color: "#7c3aed",
    icon: DownloadOutlinedIcon,
    defaultConfig: { branch: "develop", requireClean: true }
  },
  {
    type: "git.push",
    group: "git",
    color: "#7c3aed",
    icon: UploadOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "docker.up",
    group: "docker",
    color: "#059669",
    icon: PlayCircleOutlineIcon,
    defaultConfig: {}
  },
  {
    type: "docker.rebuild",
    group: "docker",
    color: "#059669",
    icon: BuildOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "docker.stop",
    group: "docker",
    color: "#059669",
    icon: StopCircleOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "terminal.command",
    group: "commands",
    color: "#d97706",
    icon: TerminalOutlinedIcon,
    defaultConfig: { command: "" }
  },
  {
    type: "output.summary",
    group: "output",
    color: "#d97706",
    icon: SummarizeOutlinedIcon,
    defaultConfig: {}
  }
];

export const AUTOMATION_NODE_GROUPS: AutomationNodeGroup[] = [
  "trigger",
  "input",
  "repository",
  "git",
  "docker",
  "commands",
  "output"
];

export function getAutomationNodeDefinition(type: WorkflowNodeType): AutomationNodeDefinition {
  return AUTOMATION_NODE_DEFINITIONS.find((definition) => definition.type === type) ?? AUTOMATION_NODE_DEFINITIONS[0];
}

export function getAutomationNodeLabel(t: TFunction, type: WorkflowNodeType): string {
  return t(`automation.nodeTypes.${type}.label`);
}

export function getAutomationNodeDescription(t: TFunction, type: WorkflowNodeType): string {
  return t(`automation.nodeTypes.${type}.description`);
}

export function getAutomationNodeGroupLabel(t: TFunction, group: AutomationNodeGroup): string {
  return t(`automation.groups.${group}`);
}

export function getAutomationNodeSummary(t: TFunction, node: WorkflowNode): string {
  switch (node.type) {
    case "input.text": {
      const key = getConfigString(node, "key", "");
      if (!key) return t("automation.nodeSummary.inputKeyMissing");

      return getConfigBoolean(node, "required", true)
        ? t("automation.nodeSummary.inputRequired", { key })
        : t("automation.nodeSummary.inputOptional", { key });
    }
    case "repository.select": {
      const mode = getConfigString(node, "mode", "all");
      if (mode === "favorites") return t("automation.nodeSummary.repositoriesFavorites");
      if (mode === "manual") {
        return t("automation.nodeSummary.repositoriesManual", {
          total: getConfigStringArray(node, "projectIds").length
        });
      }
      return t("automation.nodeSummary.repositoriesAll");
    }
    case "repository.filter": {
      const values = [
        getConfigString(node, "clean", "any"),
        getConfigString(node, "sync", "any"),
        getConfigString(node, "docker", "any")
      ].filter((value) => value !== "any");
      return values.length > 0 ? values.join(" · ") : t("automation.nodeSummary.noFilter");
    }
    case "git.pull":
      return getConfigBoolean(node, "requireClean", true)
        ? t("automation.nodeSummary.cleanOnly")
        : t("automation.nodeSummary.allowDirty");
    case "git.pullBranch": {
      const branch = getConfigString(node, "branch", "");

      if (!branch) return t("automation.nodeSummary.branchMissing");

      return getConfigBoolean(node, "requireClean", true)
        ? t("automation.nodeSummary.branchCleanOnly", { branch })
        : t("automation.nodeSummary.branchAllowDirty", { branch });
    }
    case "terminal.command":
      return getConfigString(node, "command", "") || t("automation.nodeSummary.commandMissing");
    default:
      return getAutomationNodeDescription(t, node.type);
  }
}

export function getConfigString(node: WorkflowNode, key: string, fallback: string): string {
  const value = node.config[key];
  return typeof value === "string" ? value : fallback;
}

export function getConfigStringArray(node: WorkflowNode, key: string): string[] {
  const value = node.config[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function getConfigBoolean(node: WorkflowNode, key: string, fallback: boolean): boolean {
  const value = node.config[key];
  return typeof value === "boolean" ? value : fallback;
}
