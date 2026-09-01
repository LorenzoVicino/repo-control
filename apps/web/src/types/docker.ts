export type DockerContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  runningFor: string;
  composeProject: string | null;
  composeService: string | null;
  composeWorkingDir: string | null;
};

export type DockerContainerGroup = {
  id: string;
  name: string;
  composeProject: string | null;
  workingDir: string | null;
  containers: DockerContainer[];
};

export type DockerContainersResponse = {
  ok: boolean;
  containers: DockerContainer[];
  groups: DockerContainerGroup[];
  checkedAt: string;
  error: string | null;
};

export type DockerComposePort = {
  hostIp: string | null;
  published: number | null;
  target: number;
  protocol: string;
  url: string | null;
};

export type DockerComposeService = {
  name: string;
  containerId: string | null;
  containerName: string | null;
  image: string | null;
  state: string;
  status: string;
  health: string | null;
  runningFor: string | null;
  ports: DockerComposePort[];
};

export type DockerComposeProjectResponse = {
  ok: boolean;
  name: string;
  services: DockerComposeService[];
  checkedAt: string;
  error: string | null;
};

export type DockerContainerStats = {
  id: string;
  name: string;
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
  networkInBytes: number | null;
  networkOutBytes: number | null;
  blockReadBytes: number | null;
  blockWriteBytes: number | null;
  processCount: number | null;
};

export type DockerContainerStatsResponse = {
  ok: boolean;
  stats: DockerContainerStats[];
  checkedAt: string;
  error: string | null;
};

export type ContainerSessionKind = "exec" | "logs";

export type ContainerSession = {
  id: string;
  kind: ContainerSessionKind;
  containerId: string;
  containerName: string;
  shell: string | null;
  command: string;
  createdAt: string;
  running: boolean;
  exitCode: number | null;
  // Characters produced so far. Sent back on the next read so the session streams forward
  // instead of resending its whole transcript.
  cursor: number;
};

export type ContainerSessionRead = ContainerSession & {
  chunk: string;
  truncated: boolean;
};
