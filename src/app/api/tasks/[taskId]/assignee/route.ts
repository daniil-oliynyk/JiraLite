import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { canManageProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { projectId?: string; assigneeId?: string | null };
  if (!body.projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
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

  const nextAssigneeId = String(body.assigneeId ?? "").trim() || null;

  if (nextAssigneeId) {
    const membership = await prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: nextAssigneeId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Assignee must be a project member" }, { status: 400 });
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: nextAssigneeId },
    select: {
      id: true,
      assigneeId: true,
      assignee: {
        select: { email: true },
      },
    },
  });

  const activityContent = updatedTask.assignee?.email
    ? `Assigned to ${updatedTask.assignee.email}`
    : "Assignee cleared";

  const activity = await prisma.taskComment.create({
    data: {
      taskId,
      userId: user.id,
      type: "ACTIVITY",
      content: activityContent,
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    assigneeId: updatedTask.assigneeId,
    assigneeEmail: updatedTask.assignee?.email ?? null,
    activity: {
      id: activity.id,
      type: activity.type,
      content: activity.content,
      createdAt: activity.createdAt.toISOString(),
      userEmail: activity.user.email,
    },
  });
}
