import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { ProjectVisibility, TaskStatus } from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCardActionsMenu } from "@/components/project-card-actions-menu";
import { TeamSpaceCreateProjectButton } from "@/components/team-space-create-project-button";
import { requireUser } from "@/lib/auth";
import { assertTeamAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function TeamSpacePage({ params }: { params: Promise<{ teamSpaceId: string }> }) {
  const { teamSpaceId } = await params;
  const user = await requireUser();
  const membership = await assertTeamAccess(user.id, teamSpaceId);

  const teamSpace = await prisma.teamSpace.findUnique({
    where: { id: teamSpaceId },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      projects: {
        include: {
          memberships: {
            select: {
              userId: true,
            },
          },
          tasks: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!teamSpace) {
    return <p className="text-sm text-muted-foreground">Team Space not found.</p>;
  }

  const visibleProjects = teamSpace.projects.filter((project) => {
    if (membership.role === "MANAGER") return true;
    if (project.visibility === ProjectVisibility.TEAM_VISIBLE) return true;
    return project.memberships.some((projectMembership) => projectMembership.userId === user.id);
  });

  const teamMembers = teamSpace.memberships.map((spaceMembership) => ({
    id: spaceMembership.user.id,
    email: spaceMembership.user.email,
  }));

  const projectsWithProgress = visibleProjects.map((project) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...project,
      totalTasks,
      completedTasks,
      completionPercent,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{teamSpace.name}</h1>
          <p className="text-sm text-muted-foreground">{teamSpace.description || "No description"}</p>
        </div>
        {membership.role === "MANAGER" ? (
          <TeamSpaceCreateProjectButton teamSpaceId={teamSpace.id} />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projectsWithProgress.length === 0 && (
          <Card className="border-border/70 bg-card/70 md:col-span-2 xl:col-span-3">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No projects in this space yet.
            </CardContent>
          </Card>
        )}
        {projectsWithProgress.map((project) => (
          <div key={project.id} className="group relative">
            <Link
              href={`/workspace/team-space/${teamSpace.id}/project/${project.id}`}
              className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open ${project.name}`}
            />
            <Card className="h-full border border-border/60 bg-background/30 shadow-[inset_0_1px_0_hsl(var(--border)/0.2)] transition-colors duration-200 hover:bg-background/50">
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="line-clamp-1 text-base">{project.name}</CardTitle>
                  <div className="ml-auto flex items-center gap-2 text-muted-foreground">
                    {membership.role === "MANAGER" ? (
                      <ProjectCardActionsMenu
                        projectId={project.id}
                        projectName={project.name}
                        projectDescription={project.description}
                        teamSpaceId={teamSpace.id}
                        teamMembers={teamMembers}
                        currentMemberUserIds={project.memberships.map((projectMembership) => projectMembership.userId)}
                      />
                    ) : null}
                    {project.visibility === ProjectVisibility.MEMBERS_ONLY ? (
                      <Lock className="size-3.5" />
                    ) : null}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
                <CardDescription className="line-clamp-1 text-xs">
                  {project.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <p className="text-[11px] text-muted-foreground">
                  {project.completedTasks}/{project.totalTasks} tasks completed
                </p>
                <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-blue-500/20">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${project.completionPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
