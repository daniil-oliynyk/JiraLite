import "server-only";

import { ProjectVisibility, TaskStatus, TeamRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const ACTIVITY_DAYS = 14;

type DashboardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type VisibleProject = {
  id: string;
  name: string;
  tasks: DashboardTask[];
  createdAt: Date;
};

export type WorkspaceDashboardData = {
  kpis: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  taskActivity: {
    label: string;
    created: number;
    completed: number;
  }[];
  taskDistribution: {
    label: string;
    value: number;
  }[];
  recentTasks: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: string | null;
    teamSpaceId: string;
    teamSpaceName: string;
    projectId: string;
    projectName: string;
    isOverdue: boolean;
  }[];
  teamSpaces: {
    id: string;
    name: string;
    memberCount: number;
    projectCount: number;
    taskCount: number;
    completionRate: number;
    projects: {
      id: string;
      name: string;
      completionRate: number;
    }[];
  }[];
};

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toProjectSummary(project: VisibleProject) {
  const taskCount = project.tasks.length;
  const completed = project.tasks.filter((task) => task.status === TaskStatus.DONE).length;

  return {
    id: project.id,
    name: project.name,
    completionRate: taskCount > 0 ? Math.round((completed / taskCount) * 100) : 0,
    taskCount,
    createdAt: project.createdAt,
  };
}

export async function getWorkspaceDashboardData(userId: string): Promise<WorkspaceDashboardData> {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    include: {
      teamSpace: {
        select: {
          id: true,
          name: true,
          memberships: {
            select: { id: true },
          },
          projects: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              visibility: true,
              createdAt: true,
              memberships: {
                where: { userId },
                select: { id: true },
              },
              tasks: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  dueDate: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const activityStart = addDays(todayStart, -(ACTIVITY_DAYS - 1));
  const recentTasksStart = addDays(todayStart, -4);

  const activityBuckets = new Map<string, { label: string; created: number; completed: number }>();
  for (let index = 0; index < ACTIVITY_DAYS; index += 1) {
    const date = addDays(activityStart, index);
    activityBuckets.set(dayKey(date), {
      label: formatDayLabel(date),
      created: 0,
      completed: 0,
    });
  }

  let totalTasks = 0;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let overdueTasks = 0;

  const recentTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: Date | null;
    teamSpaceId: string;
    teamSpaceName: string;
    projectId: string;
    projectName: string;
    isOverdue: boolean;
    updatedAt: Date;
  }> = [];

  const teamSpaceSummaries = memberships.map((membership) => {
    const visibleProjects: VisibleProject[] = membership.teamSpace.projects
      .filter((project) => {
        if (membership.role === TeamRole.MANAGER) return true;
        if (project.visibility === ProjectVisibility.TEAM_VISIBLE) return true;
        return project.memberships.length > 0;
      })
      .map((project) => ({
        id: project.id,
        name: project.name,
        tasks: project.tasks,
        createdAt: project.createdAt,
      }));

    const allTasks = visibleProjects.flatMap((project) => project.tasks);
    const doneInSpace = allTasks.filter((task) => task.status === TaskStatus.DONE).length;

    for (const project of visibleProjects) {
      for (const task of project.tasks) {
        totalTasks += 1;

        if (task.status === TaskStatus.DONE) {
          completedTasks += 1;
        }

        if (task.status === TaskStatus.IN_PROGRESS) {
          inProgressTasks += 1;
        }

        const isOverdue = Boolean(task.dueDate && task.dueDate < now && task.status !== TaskStatus.DONE);
        if (isOverdue) {
          overdueTasks += 1;
        }

        const createdBucket = activityBuckets.get(dayKey(task.createdAt));
        if (createdBucket) {
          createdBucket.created += 1;
        }

        if (task.status === TaskStatus.DONE) {
          const completedBucket = activityBuckets.get(dayKey(task.updatedAt));
          if (completedBucket) {
            completedBucket.completed += 1;
          }
        }

        if (task.createdAt >= recentTasksStart) {
          recentTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            dueDate: task.dueDate,
            teamSpaceId: membership.teamSpace.id,
            teamSpaceName: membership.teamSpace.name,
            projectId: project.id,
            projectName: project.name,
            isOverdue,
            updatedAt: task.updatedAt,
          });
        }
      }
    }

    const projectSummaries = visibleProjects
      .map(toProjectSummary)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3)
      .map(({ id, name, completionRate }) => ({ id, name, completionRate }));

    return {
      id: membership.teamSpace.id,
      name: membership.teamSpace.name,
      memberCount: membership.teamSpace.memberships.length,
      projectCount: visibleProjects.length,
      taskCount: allTasks.length,
      completionRate: allTasks.length > 0 ? Math.round((doneInSpace / allTasks.length) * 100) : 0,
      projects: projectSummaries,
    };
  });

  const todoTasks = totalTasks - completedTasks - inProgressTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    kpis: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate,
    },
    taskActivity: Array.from(activityBuckets.values()),
    taskDistribution: [
      { label: "To Do", value: todoTasks },
      { label: "In Progress", value: inProgressTasks },
      { label: "Done", value: completedTasks },
    ],
    recentTasks: recentTasks
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        teamSpaceId: task.teamSpaceId,
        teamSpaceName: task.teamSpaceName,
        projectId: task.projectId,
        projectName: task.projectName,
        isOverdue: task.isOverdue,
      })),
    teamSpaces: teamSpaceSummaries,
  };
}

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
