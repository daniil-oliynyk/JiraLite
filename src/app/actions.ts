"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProjectVisibility, TaskPriority, TaskStatus, TeamRole } from "@prisma/client";
import { z } from "zod";

import { clearSession, loginManager, registerManager, requireManager, requireUser } from "@/lib/auth";
import { canManageProject, canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseDurationToMinutes } from "@/lib/utils";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signUpAction(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return;
  }

  try {
    await registerManager(parsed.data.email, parsed.data.password);
  } catch {
    return;
  }

  redirect("/workspace");
}

export async function signInAction(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return;
  }

  try {
    await loginManager(parsed.data.email, parsed.data.password);
  } catch {
    return;
  }

  redirect("/workspace");
}

export async function signOutAction() {
  await clearSession();
  redirect("/sign-in");
}

export async function createTeamSpaceAction(formData: FormData) {
  const user = await requireManager();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return;
  }

  const space = await prisma.teamSpace.create({
    data: {
      name,
      description: description || null,
      ownerId: user.id,
      memberships: {
        create: {
          userId: user.id,
          role: TeamRole.MANAGER,
        },
      },
    },
  });

  revalidatePath("/workspace");
  redirect(`/workspace/team-space/${space.id}`);
}

export async function createProjectAction(formData: FormData) {
  const user = await requireManager();
  const teamSpaceId = String(formData.get("teamSpaceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const visibilityRaw = String(formData.get("visibility") ?? ProjectVisibility.MEMBERS_ONLY);

  if (!teamSpaceId || !name) {
    return;
  }

  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamSpaceId: {
        userId: user.id,
        teamSpaceId,
      },
    },
  });

  if (!membership || membership.role !== TeamRole.MANAGER) {
    return;
  }

  const visibility = visibilityRaw === ProjectVisibility.TEAM_VISIBLE ? ProjectVisibility.TEAM_VISIBLE : ProjectVisibility.MEMBERS_ONLY;

  const project = await prisma.project.create({
    data: {
      teamSpaceId,
      name,
      description: description || null,
      visibility,
      createdById: user.id,
      memberships: {
        create: {
          userId: user.id,
        },
      },
    },
  });

  revalidatePath(`/workspace/team-space/${teamSpaceId}`);
  redirect(`/workspace/team-space/${teamSpaceId}/project/${project.id}`);
}

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();

  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? TaskStatus.TODO) as TaskStatus;
  const priority = String(formData.get("priority") ?? TaskPriority.MEDIUM) as TaskPriority;
  const estimation = String(formData.get("estimation") ?? "");

  if (!title || !projectId) {
    return;
  }

  const canManage = await canManageProject(user.id, projectId);
  if (!canManage) {
    return;
  }

  const estimationMinutes = parseDurationToMinutes(estimation);
  if (estimation && estimationMinutes === null) {
    return;
  }

  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const assigneeIdRaw = String(formData.get("assigneeId") ?? "").trim();

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description: description || null,
      status,
      priority,
      estimationMinutes,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      assigneeId: assigneeIdRaw || null,
      createdById: user.id,
    },
  });

  await prisma.taskComment.create({
    data: {
      taskId: task.id,
      userId: user.id,
      type: "ACTIVITY",
      content: `Task created: ${task.title}`,
    },
  });

  await prisma.outboxEvent.create({
    data: {
      eventType: "TASK_CREATED",
      aggregateId: task.id,
      payloadJson: JSON.stringify({ projectId, taskId: task.id, actorId: user.id }),
    },
  });

  revalidatePath("/workspace");
}

export async function addTaskCommentAction(formData: FormData) {
  const user = await requireUser();

  const taskId = String(formData.get("taskId") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  if (!taskId || !content) {
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) {
    return;
  }

  const canView = await canViewProject(user.id, task.projectId);
  if (!canView) {
    return;
  }

  await prisma.taskComment.create({
    data: {
      taskId,
      userId: user.id,
      content,
      type: "COMMENT",
    },
  });

  revalidatePath("/workspace");
}
