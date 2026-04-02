import Link from "next/link";
import { ProjectVisibility } from "@prisma/client";

import { createProjectAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
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

        <Card className="h-fit border-primary/40 bg-card/80">
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <CardDescription>
              Managers can create private or team-visible projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProjectAction} className="space-y-4">
              <input type="hidden" name="teamSpaceId" value={teamSpace.id} />
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input id="name" name="name" required placeholder="Q3 Platform Migration" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Scope, goals, dependencies..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select id="visibility" name="visibility" defaultValue={ProjectVisibility.MEMBERS_ONLY}>
                  <option value={ProjectVisibility.MEMBERS_ONLY}>Members only</option>
                  <option value={ProjectVisibility.TEAM_VISIBLE}>Visible to Team Space</option>
                </Select>
              </div>
              <Button className="w-full" type="submit">Create Project</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
