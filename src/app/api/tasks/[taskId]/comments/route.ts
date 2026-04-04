import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { content?: string };
  const content = String(body.content ?? "").trim();

  if (!content) {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const canView = await canViewProject(user.id, task.projectId);
  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      userId: user.id,
      content,
      type: "COMMENT",
    },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      type: comment.type,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      userEmail: comment.user.email,
    },
  });
}
