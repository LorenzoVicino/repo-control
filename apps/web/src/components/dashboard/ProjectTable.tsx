import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import { alpha, Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { StatusChips } from "../shared/StatusChips";
import { SyncChips } from "../shared/SyncChips";
import type { ProjectSummary } from "../../types";

type ProjectTableProps = {
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
};

export function ProjectTable({ projects, onSelectProject }: ProjectTableProps) {
  if (projects.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6">Nessun repository trovato</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Modifica la ricerca o seleziona un altro workspace.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: "calc(100dvh - 220px)" }}>
      <Table size="small" stickyHeader sx={{ minWidth: 1040 }}>
        <TableHead>
          <TableRow>
            <TableCell>Repository</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Stato</TableCell>
            <TableCell>Sincronizzazione</TableCell>
            <TableCell>Ultimo commit</TableCell>
            <TableCell>Percorso</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.map((project) => (
            <TableRow
              key={project.id}
              hover
              tabIndex={0}
              onClick={() => onSelectProject(project.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectProject(project.id);
                }
              }}
              sx={{
                cursor: "pointer",
                "&:focus-visible": {
                  outline: "3px solid",
                  outlineColor: (theme) => alpha(theme.palette.primary.main, 0.25),
                  outlineOffset: -3
                }
              }}
            >
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 170 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      borderRadius: 1,
                      color: project.isClean ? "success.main" : "warning.main",
                      bgcolor: (theme) =>
                        alpha(project.isClean ? theme.palette.success.main : theme.palette.warning.main, 0.1)
                    }}
                  >
                    <AccountTreeIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                    {project.name}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <CallSplitIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                  <Typography variant="body2" noWrap>
                    {project.branch}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <StatusChips project={project} />
              </TableCell>
              <TableCell>
                <SyncChips project={project} />
              </TableCell>
              <TableCell sx={{ maxWidth: 320 }}>
                {project.lastCommit ? (
                  <Box>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {project.lastCommit.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {project.lastCommit.hash} · {project.lastCommit.author}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Nessun commit
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ color: "text.secondary", maxWidth: 360 }} title={project.path}>
                <Typography
                  variant="caption"
                  noWrap
                  component="div"
                  sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
                >
                  {project.path}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
