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
