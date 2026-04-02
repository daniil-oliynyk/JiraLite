import { notFound } from "next/navigation";
import { TaskPriority, TaskStatus } from "@prisma/client";

import { addTaskCommentAction, createTaskAction } from "@/app/actions";
import { KanbanBoard } from "@/components/kanban-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_ORDER } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { canManageProject, canViewProject } from "@/lib/permissions";
import { getProjectBoardData } from "@/lib/queries";

export default async function ProjectPage({ params }: { params: Promise<{ teamSpaceId: string; projectId: string }> }) {
  const { teamSpaceId, projectId } = await params;
  const user = await requireUser();

  const visible = await canViewProject(user.id, projectId);
  if (!visible) {
    notFound();
  }

  const canManage = await canManageProject(user.id, projectId);
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle>Create Task</CardTitle>
            <CardDescription>
              Start date and end date are required; due date is optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createTaskAction} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required placeholder="Implement sprint intake form" disabled={!canManage} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Details and context" disabled={!canManage} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select id="status" name="status" defaultValue={TaskStatus.TODO} disabled={!canManage}>
                    {TASK_STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select id="priority" name="priority" defaultValue={TaskPriority.MEDIUM} disabled={!canManage}>
                    {TASK_PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" required disabled={!canManage} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" type="date" required disabled={!canManage} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date (optional)</Label>
                  <Input id="dueDate" name="dueDate" type="date" disabled={!canManage} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimation">Estimation</Label>
                  <Input id="estimation" name="estimation" placeholder="2h" disabled={!canManage} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="assigneeId">Assignee</Label>
                  <Select id="assigneeId" name="assigneeId" defaultValue="" disabled={!canManage}>
                    <option value="">Unassigned</option>
                    {project.memberships.map((membership) => (
                      <option key={membership.user.id} value={membership.user.id}>{membership.user.email}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={!canManage}>Create Task</Button>
            </form>
          </CardContent>
        </Card>

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
    </div>
  );
}
