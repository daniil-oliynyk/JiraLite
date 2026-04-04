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

  const body = (await request.json()) as { description?: string; projectId?: string };
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

  const trimmed = String(body.description ?? "").trim();
  const nextDescription = trimmed || null;

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: { description: nextDescription },
    select: { id: true, description: true },
  });

  await prisma.taskComment.create({
    data: {
      taskId,
      userId: user.id,
      type: "ACTIVITY",
      content: nextDescription ? "Description updated" : "Description cleared",
    },
  });

  const latestActivity = await prisma.taskComment.findFirst({
    where: {
      taskId,
      userId: user.id,
      type: "ACTIVITY",
      content: nextDescription ? "Description updated" : "Description cleared",
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });

  return NextResponse.json({
    ok: true,
    description: updatedTask.description,
    activity: latestActivity
      ? {
          id: latestActivity.id,
          type: latestActivity.type,
          content: latestActivity.content,
          createdAt: latestActivity.createdAt.toISOString(),
          userEmail: latestActivity.user.email,
        }
      : null,
  });
}
