import { NextRequest, NextResponse } from "next/server";
import { TaskPriority } from "@prisma/client";

import { requireApiUser } from "@/lib/api-auth";
import { canManageProject, canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseDurationToMinutes } from "@/lib/utils";

export async function GET(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;

  const { user, response } = await requireApiUser();
  if (response) {
    return response;
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const canView = await canViewProject(user.id, projectId);
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          teamSpace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      assignee: {
        select: {
          id: true,
          email: true,
        },
      },
      comments: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  if (!task || task.projectId !== projectId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      estimationMinutes: task.estimationMinutes,
      dueDate: task.dueDate?.toISOString() ?? null,
      assigneeEmail: task.assignee?.email ?? null,
      projectId: task.project.id,
      projectName: task.project.name,
      teamSpaceId: task.project.teamSpace.id,
      teamSpaceName: task.project.teamSpace.name,
      comments: task.comments.map((comment) => ({
        id: comment.id,
        type: comment.type,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        userEmail: comment.user.email,
      })),
    },
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;

  const { user, response } = await requireApiUser();
  if (response) {
    return response;
  }

  const body = (await request.json()) as {
    projectId?: string;
    priority?: TaskPriority;
    estimation?: string;
    dueDate?: string | null;
  };

  if (!body.projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const hasUpdate = body.priority !== undefined || body.estimation !== undefined || body.dueDate !== undefined;
  if (!hasUpdate) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task || task.projectId !== body.projectId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const canManage = await canManageProject(user.id, task.projectId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: {
    priority?: TaskPriority;
    estimationMinutes?: number | null;
    dueDate?: Date | null;
  } = {};

  if (body.priority !== undefined) {
    const priorityAllowed = PRIORITY_OPTIONS.includes(body.priority);
    if (!priorityAllowed) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    data.priority = body.priority;
  }

  if (body.estimation !== undefined) {
    const estimationRaw = String(body.estimation ?? "").trim();
    const estimationMinutes = parseDurationToMinutes(estimationRaw);
    if (estimationRaw && estimationMinutes === null) {
      return NextResponse.json({ error: "Invalid estimation format" }, { status: 400 });
    }
    data.estimationMinutes = estimationRaw ? estimationMinutes : null;
  }

  if (body.dueDate !== undefined) {
    const dueDateRaw = String(body.dueDate ?? "").trim();
    if (!dueDateRaw) {
      data.dueDate = null;
    } else {
      const nextDate = new Date(dueDateRaw);
      if (Number.isNaN(nextDate.getTime())) {
        return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
      }
      data.dueDate = nextDate;
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data,
    select: {
      priority: true,
      estimationMinutes: true,
      dueDate: true,
    },
  });

  const activityParts: string[] = [];
  if (body.priority !== undefined) {
    activityParts.push(`priority set to ${updatedTask.priority}`);
  }
  if (body.estimation !== undefined) {
    activityParts.push(
      updatedTask.estimationMinutes !== null ? `estimation set to ${updatedTask.estimationMinutes} minutes` : "estimation cleared",
    );
  }
  if (body.dueDate !== undefined) {
    activityParts.push(updatedTask.dueDate ? "due date updated" : "due date cleared");
  }

  const activity = await prisma.taskComment.create({
    data: {
      taskId,
      userId: user.id,
      type: "ACTIVITY",
      content: activityParts.join(", "),
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    priority: updatedTask.priority,
    estimationMinutes: updatedTask.estimationMinutes,
    dueDate: updatedTask.dueDate?.toISOString() ?? null,
    activity: {
      id: activity.id,
      type: activity.type,
      content: activity.content,
      createdAt: activity.createdAt.toISOString(),
      userEmail: activity.user.email,
    },
  });
}

const PRIORITY_OPTIONS: TaskPriority[] = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];
