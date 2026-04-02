import Link from "next/link";

import { createTeamSpaceAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { getWorkspaceOverview } from "@/lib/queries";

export default async function WorkspacePage() {
  const user = await requireUser();
  const spaces = await getWorkspaceOverview(user.id);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-6">
        <h2 className="text-2xl font-semibold">Team Spaces</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage organizational units, private project visibility, and task execution in a dark-mode workspace.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {spaces.length === 0 && (
            <Card className="md:col-span-2">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                No Team Spaces yet. Create your first one from the panel on the right.
              </CardContent>
            </Card>
          )}
          {spaces.map((space) => (
            <Card key={space.id} className="bg-card/70">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{space.name}</CardTitle>
                  <Badge>{space.role}</Badge>
                </div>
                <CardDescription>
                  {space.projectCount} projects • {space.taskCount} tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/workspace/team-space/${space.id}`}>
                  <Button size="sm">Open Space</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit border-primary/40 bg-card/80">
          <CardHeader>
            <CardTitle>Create New Team Space</CardTitle>
            <CardDescription>Managers can create spaces and later invite workers and assign project access.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createTeamSpaceAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="Engineering" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Cross-functional platform and delivery programs" />
              </div>
              <Button type="submit" className="w-full">Create Space</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
