import Link from "next/link";
import { ProjectVisibility } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      projects: {
        include: {
          memberships: {
            where: { userId: user.id },
          },
          tasks: {
            select: { id: true },
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
    return project.memberships.length > 0;
  });

  return (
    <div className="space-y-6">
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-2xl">{teamSpace.name}</CardTitle>
          <CardDescription>{teamSpace.description || "No description"}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {visibleProjects.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No projects in this space yet.
            </CardContent>
          </Card>
        )}
        {visibleProjects.map((project) => (
          <Card key={project.id} className="bg-card/70">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <Badge>{project.visibility}</Badge>
              </div>
              <CardDescription>{project.description || "No description"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">{project.tasks.length} tasks</p>
              <Link href={`/workspace/team-space/${teamSpace.id}/project/${project.id}`}>
                <Button size="sm">Open Project</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
