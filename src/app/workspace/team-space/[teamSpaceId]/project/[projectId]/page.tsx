import { notFound } from "next/navigation";

import { addTaskCommentAction } from "@/app/actions";
import { KanbanBoard } from "@/components/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="space-y-6">
      <Card className="bg-card/70">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <CardDescription>{project.description || "No description"}</CardDescription>
            </div>
            <Badge>{project.visibility}</Badge>
          </div>
        </CardHeader>
      </Card>

      <KanbanBoard projectId={project.id} tasks={boardTasks} />

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle>Recent Task Activity & Comments</CardTitle>
          <CardDescription>
            Accountability events currently appear in the comments feed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.tasks.slice(0, 6).map((task) => (
            <div key={task.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{task.title}</p>
                <Badge>{task.status}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {task.comments.slice(0, 3).map((comment) => (
                  <p key={comment.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{comment.user.email}</span>: {comment.content}
                  </p>
                ))}
              </div>
              <form action={addTaskCommentAction} className="mt-3 flex gap-2">
                <input type="hidden" name="taskId" value={task.id} />
                <Input name="content" placeholder="Add comment" required />
                <Button size="sm" type="submit">Post</Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
