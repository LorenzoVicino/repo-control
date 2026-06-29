import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
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
        <Typography>No Git repositories found.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Project</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Sync</TableCell>
            <TableCell>Last commit</TableCell>
            <TableCell>Path</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} hover onClick={() => onSelectProject(project.id)} sx={{ cursor: "pointer" }}>
              <TableCell sx={{ fontWeight: 700 }}>{project.name}</TableCell>
              <TableCell>{project.branch}</TableCell>
              <TableCell>
                <StatusChips project={project} />
              </TableCell>
              <TableCell>
                <SyncChips project={project} />
              </TableCell>
              <TableCell sx={{ maxWidth: 340 }}>
                {project.lastCommit ? (
                  <Box>
                    <Typography variant="body2" noWrap>
                      {project.lastCommit.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {project.lastCommit.hash} by {project.lastCommit.author}
                    </Typography>
                  </Box>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", color: "text.secondary", maxWidth: 420 }} title={project.path}>
                <Typography variant="caption" noWrap component="div">
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
