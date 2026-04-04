import { notFound } from "next/navigation";

import { KanbanBoard } from "@/components/kanban-board";
import { requireUser } from "@/lib/auth";
import { canViewProject } from "@/lib/permissions";
import { getProjectBoardData } from "@/lib/queries";

export default async function ProjectPage({ params }: { params: Promise<{ teamSpaceId: string; projectId: string }> }) {
  const { teamSpaceId, projectId } = await params;
  const user = await requireUser();

  const visible = await canViewProject(user.id, projectId);
  if (!visible) {
    notFound();
  }

  const project = await getProjectBoardData(projectId);

  if (!project || project.teamSpaceId !== teamSpaceId) {
    notFound();
  }

  const boardTasks = project.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    estimationMinutes: task.estimationMinutes,
    dueDate: task.dueDate?.toISOString() ?? null,
    assigneeEmail: task.assignee?.email ?? null,
  }));

  const assignees = project.memberships.map((membership) => ({
    id: membership.user.id,
    email: membership.user.email,
  }));

  return (
    <div className="space-y-4">
      <KanbanBoard
        projectId={project.id}
        projectName={project.name}
        projectDescription={project.description}
        tasks={boardTasks}
        assignees={assignees}
      />
    </div>
  );
}
