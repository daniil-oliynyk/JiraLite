"use client";

import Link from "next/link";
import { useState } from "react";
import { CommentType, TaskPriority, TaskStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDurationFromMinutes } from "@/lib/utils";

type RecentTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  teamSpaceId: string;
  teamSpaceName: string;
  projectId: string;
  projectName: string;
  isOverdue: boolean;
};

type TaskDetails = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimationMinutes: number | null;
  dueDate: string | null;
  assigneeEmail: string | null;
  projectId: string;
  projectName: string;
  teamSpaceId: string;
  teamSpaceName: string;
  comments: {
    id: string;
    type: CommentType;
    content: string;
    createdAt: string;
    userEmail: string;
  }[];
};

function taskStatusLabel(status: TaskStatus) {
  if (status === TaskStatus.TODO) return "To Do";
  if (status === TaskStatus.IN_PROGRESS) return "In Progress";
  return "Done";
}

function taskStatusClass(status: TaskStatus) {
  if (status === TaskStatus.DONE) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === TaskStatus.IN_PROGRESS) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WorkspaceRecentTasksCard({ tasks }: { tasks: RecentTask[] }) {
  const [selectedTask, setSelectedTask] = useState<RecentTask | null>(null);
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  async function openTaskDetails(task: RecentTask) {
    setSelectedTask(task);
    setTaskDetails(null);
    setDetailsError(null);
    setLoadingDetails(true);

    try {
      const response = await fetch(`/api/tasks/${task.id}/details?projectId=${encodeURIComponent(task.projectId)}`);

      if (!response.ok) {
        setDetailsError("Could not load full task details right now.");
        return;
      }

      const payload = (await response.json()) as { task?: TaskDetails };
      if (!payload.task) {
        setDetailsError("Task details were not returned.");
        return;
      }

      setTaskDetails(payload.task);
    } catch {
      setDetailsError("Could not load full task details right now.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function closeTaskDetails() {
    setSelectedTask(null);
    setTaskDetails(null);
    setDetailsError(null);
    setLoadingDetails(false);
  }

  return (
    <>
      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
          <CardDescription>Created in the last 5 days</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent tasks yet.</p>
          ) : (
            <div className="max-h-[330px] space-y-4 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    void openTaskDetails(task);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-left transition-colors hover:bg-background/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.teamSpaceName} • {task.projectName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge>
                    <p className={`text-xs ${task.isOverdue ? "text-rose-300" : "text-muted-foreground"}`}>
                      {formatDueDate(task.dueDate)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTask ? (
        <DialogContent
          onClose={closeTaskDetails}
          className="max-w-xl border-border/80 bg-card/95 p-0 text-foreground backdrop-blur"
        >
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="pr-8 text-xl leading-tight">{taskDetails?.title ?? selectedTask.title}</DialogTitle>
              <DialogDescription>Task details from your Recent Tasks list</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 rounded-lg border border-border/70 bg-background/50 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <Badge className={taskStatusClass(taskDetails?.status ?? selectedTask.status)}>
                  {taskStatusLabel(taskDetails?.status ?? selectedTask.status)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
                <p className="text-sm text-foreground">{taskDetails?.priority ?? "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</p>
                <p className="text-sm text-foreground">{taskDetails?.assigneeEmail ?? "Unassigned"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimation</p>
                <p className="text-sm text-foreground">{formatDurationFromMinutes(taskDetails?.estimationMinutes ?? null)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Due Date</p>
                <p className={selectedTask.isOverdue ? "text-sm text-rose-300" : "text-sm text-foreground"}>
                  {formatDueDate(taskDetails?.dueDate ?? selectedTask.dueDate)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Team Space</p>
                <p className="text-sm text-foreground">{taskDetails?.teamSpaceName ?? selectedTask.teamSpaceName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                <p className="text-sm text-foreground">{taskDetails?.projectName ?? selectedTask.projectName}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
              {loadingDetails ? (
                <p className="text-sm text-muted-foreground">Loading details...</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {taskDetails?.description?.trim() ? taskDetails.description : "No description provided."}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent Activity</p>
              {detailsError ? (
                <p className="text-sm text-rose-300">{detailsError}</p>
              ) : loadingDetails ? (
                <p className="text-sm text-muted-foreground">Loading activity...</p>
              ) : taskDetails && taskDetails.comments.length > 0 ? (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {taskDetails.comments.map((comment) => (
                    <div key={comment.id} className="rounded-md border border-border/60 bg-background/70 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>{comment.userEmail}</span>
                        <span>{formatDateTime(comment.createdAt)}</span>
                      </div>
                      <p className={comment.type === CommentType.ACTIVITY ? "text-xs text-muted-foreground" : "text-sm text-foreground"}>
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href={`/workspace/team-space/${taskDetails?.teamSpaceId ?? selectedTask.teamSpaceId}/project/${taskDetails?.projectId ?? selectedTask.projectId}`}
                className="inline-flex items-center rounded-md border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Go to project board
              </Link>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </>
  );
}
