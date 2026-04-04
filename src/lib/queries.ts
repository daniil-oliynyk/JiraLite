import "server-only";

import { ProjectVisibility, TaskStatus, TeamRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getWorkspaceSidebarData(userId: string) {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    include: {
      teamSpace: {
        select: {
          id: true,
          name: true,
          memberships: {
            select: {
              user: {
                select: { id: true, email: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          projects: {
            select: { id: true, name: true, visibility: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.teamSpace.id,
    name: m.teamSpace.name,
    projects: m.teamSpace.projects,
    members: m.teamSpace.memberships.map((membership) => membership.user),
  }));
}

export async function getWorkspaceOverview(userId: string) {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    include: {
      teamSpace: {
        include: {
          projects: {
            include: {
              memberships: {
                where: { userId },
              },
              tasks: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  return memberships.map((membership) => {
    const visibleProjects = membership.teamSpace.projects.filter((project) => {
      if (membership.role === TeamRole.MANAGER) return true;
      if (project.visibility === ProjectVisibility.TEAM_VISIBLE) return true;
      return project.memberships.length > 0;
    });

    return {
      id: membership.teamSpace.id,
      name: membership.teamSpace.name,
      role: membership.role,
      projectCount: visibleProjects.length,
      taskCount: visibleProjects.reduce((sum, project) => sum + project.tasks.length, 0),
    };
  });
}

export async function getProjectBoardData(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      teamSpace: {
        include: {
          memberships: {
            include: {
              user: {
                select: { id: true, email: true },
              },
            },
          },
        },
      },
      memberships: {
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, email: true } },
          comments: {
            orderBy: { createdAt: "desc" },
            take: 12,
            include: { user: { select: { email: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export function groupTasksByStatus<T extends { status: TaskStatus }>(tasks: T[]) {
  return {
    [TaskStatus.TODO]: tasks.filter((task) => task.status === TaskStatus.TODO),
    [TaskStatus.IN_PROGRESS]: tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS),
    [TaskStatus.DONE]: tasks.filter((task) => task.status === TaskStatus.DONE),
  };
}
