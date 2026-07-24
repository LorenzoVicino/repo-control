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
import React from "react";
import type { WorkflowNode, WorkflowNodeType } from "../../types/workflows";

export type AutomationNodeGroup = "Avvio" | "Input" | "Repository" | "Git" | "Docker" | "Comandi" | "Output";

export type AutomationNodeDefinition = {
  type: WorkflowNodeType;
  label: string;
  description: string;
  group: AutomationNodeGroup;
  color: string;
  icon: React.ComponentType<SvgIconProps>;
  defaultConfig: Record<string, unknown>;
};

export const AUTOMATION_NODE_DEFINITIONS: AutomationNodeDefinition[] = [
  {
    type: "trigger.manual",
    label: "Avvio manuale",
    description: "Punto di ingresso del workflow",
    group: "Avvio",
    color: "#2563eb",
    icon: PlayArrowRoundedIcon,
    defaultConfig: {}
  },
  {
    type: "input.text",
    label: "Input di testo",
    description: "Richiedi un valore prima dell'esecuzione",
    group: "Input",
    color: "#db2777",
    icon: TextFieldsOutlinedIcon,
    defaultConfig: {
      key: "text",
      label: "Valore",
      description: "",
      placeholder: "",
      defaultValue: "",
      required: true,
      multiline: false
    }
  },
  {
    type: "repository.select",
    label: "Seleziona repository",
    description: "Tutti, preferiti o selezione manuale",
    group: "Repository",
    color: "#0891b2",
    icon: AccountTreeOutlinedIcon,
    defaultConfig: { mode: "all", projectIds: [] }
  },
  {
    type: "repository.filter",
    label: "Filtra repository",
    description: "Stato locale, sync e Docker",
    group: "Repository",
    color: "#0891b2",
    icon: FilterAltOutlinedIcon,
    defaultConfig: { clean: "any", sync: "any", docker: "any" }
  },
  {
    type: "git.fetch",
    label: "Git fetch",
    description: "Aggiorna tutti i riferimenti remoti",
    group: "Git",
    color: "#7c3aed",
    icon: CloudSyncOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "git.pull",
    label: "Git pull",
    description: "Pull fast-forward del branch corrente",
    group: "Git",
    color: "#7c3aed",
    icon: DownloadOutlinedIcon,
    defaultConfig: { requireClean: true }
  },
  {
    type: "git.pullDevelop",
    label: "Pull develop",
    description: "Aggiorna da origin/develop",
    group: "Git",
    color: "#7c3aed",
    icon: DownloadOutlinedIcon,
    defaultConfig: { requireClean: true }
  },
  {
    type: "git.push",
    label: "Git push",
    description: "Invia il branch corrente al remoto",
    group: "Git",
    color: "#7c3aed",
    icon: UploadOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "docker.up",
    label: "Compose up",
    description: "Avvia i servizi in background",
    group: "Docker",
    color: "#059669",
    icon: PlayCircleOutlineIcon,
    defaultConfig: {}
  },
  {
    type: "docker.rebuild",
    label: "Compose rebuild",
    description: "Ricostruisce e avvia i servizi",
    group: "Docker",
    color: "#059669",
    icon: BuildOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "docker.stop",
    label: "Compose stop",
    description: "Ferma i servizi del progetto",
    group: "Docker",
    color: "#059669",
    icon: StopCircleOutlinedIcon,
    defaultConfig: {}
  },
  {
    type: "terminal.command",
    label: "Comando terminale",
    description: "Esegue un comando in ogni repository",
    group: "Comandi",
    color: "#d97706",
    icon: TerminalOutlinedIcon,
    defaultConfig: { command: "" }
  },
  {
    type: "output.summary",
    label: "Riepilogo",
    description: "Chiude il flusso con un riepilogo",
    group: "Output",
    color: "#d97706",
    icon: SummarizeOutlinedIcon,
    defaultConfig: {}
  }
];

export const AUTOMATION_NODE_GROUPS: AutomationNodeGroup[] = [
  "Avvio",
  "Input",
  "Repository",
  "Git",
  "Docker",
  "Comandi",
  "Output"
];

export function getAutomationNodeDefinition(type: WorkflowNodeType): AutomationNodeDefinition {
  return AUTOMATION_NODE_DEFINITIONS.find((definition) => definition.type === type) ?? AUTOMATION_NODE_DEFINITIONS[0];
}

export function getAutomationNodeSummary(node: WorkflowNode): string {
  switch (node.type) {
    case "input.text": {
      const key = getConfigString(node, "key", "");
      return key
        ? `${key}${getConfigBoolean(node, "required", true) ? " · obbligatorio" : " · opzionale"}`
        : "Chiave da configurare";
    }
    case "repository.select": {
      const mode = getConfigString(node, "mode", "all");
      if (mode === "favorites") return "Repository preferiti";
      if (mode === "manual") return `${getConfigStringArray(node, "projectIds").length} selezionati`;
      return "Tutti i repository";
    }
    case "repository.filter": {
      const values = [
        getConfigString(node, "clean", "any"),
        getConfigString(node, "sync", "any"),
        getConfigString(node, "docker", "any")
      ].filter((value) => value !== "any");
      return values.length > 0 ? values.join(" · ") : "Nessun filtro";
    }
    case "git.pull":
    case "git.pullDevelop":
      return getConfigBoolean(node, "requireClean", true) ? "Solo checkout puliti" : "Consenti modifiche locali";
    case "terminal.command":
      return getConfigString(node, "command", "") || "Comando da configurare";
    default:
      return getAutomationNodeDefinition(node.type).description;
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
