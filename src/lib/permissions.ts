import "server-only";

import { ProjectVisibility, TeamRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function assertTeamAccess(userId: string, teamSpaceId: string) {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamSpaceId: { userId, teamSpaceId },
    },
  });

  if (!membership) {
    throw new Error("You do not have access to this Team Space.");
  }

  return membership;
}

export async function canViewProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      teamSpace: {
        include: {
          memberships: {
            where: { userId },
            select: { role: true },
          },
        },
      },
      memberships: {
        where: { userId },
      },
    },
  });

  if (!project) return false;

  const inSpace = project.teamSpace.memberships.length > 0;
  if (!inSpace) return false;

  const role = project.teamSpace.memberships[0]?.role;
  if (role === TeamRole.MANAGER) return true;

  if (project.visibility === ProjectVisibility.TEAM_VISIBLE) return true;

  return project.memberships.length > 0;
}

export async function canManageProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      teamSpace: {
        include: {
          memberships: {
            where: { userId },
            select: { role: true },
          },
        },
      },
    },
  });

  if (!project) return false;

  const membership = project.teamSpace.memberships[0];
  if (!membership) return false;

  if (membership.role === TeamRole.MANAGER) return true;

  const projectMembership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  return Boolean(projectMembership);
}
