import Link from "next/link";
import { Activity, AlertCircle, CheckCircle2, ChartPie, Clock3, ListTodo } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskActivityChart, TaskDistributionChart } from "@/components/workspace-dashboard-charts";
import { WorkspaceRecentTasksCard } from "@/components/workspace-recent-tasks-card";
import { requireUser } from "@/lib/auth";
import { getWorkspaceDashboardData } from "@/lib/queries";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function WorkspacePage() {
  const user = await requireUser();
  const dashboard = await getWorkspaceDashboardData(user.id);
  const displayName = user.firstName || user.email.split("@")[0] || "there";

  return (
    <div className="space-y-6 lg:space-y-7">
      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/85 to-background/50 p-6 shadow-[inset_0_1px_0_hsl(var(--border)/0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {displayName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Here&apos;s an overview of your workspace activity.</p>
          </div>
          <Badge className="border-zinc-500/30 bg-zinc-500/10 text-zinc-300">Last 14 days</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Tasks</CardDescription>
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-zinc-500/30 bg-zinc-500/10">
                <ListTodo className="size-3.5 text-zinc-300" />
              </span>
            </div>
            <CardTitle className="text-3xl">{formatCount(dashboard.kpis.totalTasks)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across all visible projects</CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Completed</CardDescription>
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="size-3.5 text-emerald-300" />
              </span>
            </div>
            <CardTitle className="text-3xl">{formatCount(dashboard.kpis.completedTasks)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${dashboard.kpis.completionRate}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <p className="text-muted-foreground">Completion rate</p>
              <p className="font-medium text-emerald-300">{dashboard.kpis.completionRate}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>In Progress</CardDescription>
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                <Clock3 className="size-3.5 text-amber-300" />
              </span>
            </div>
            <CardTitle className="text-3xl">{formatCount(dashboard.kpis.inProgressTasks)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-300">Active execution queue</CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Overdue</CardDescription>
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
                <AlertCircle className="size-3.5 text-rose-300" />
              </span>
            </div>
            <CardTitle className="text-3xl">{formatCount(dashboard.kpis.overdueTasks)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-rose-300">Needs attention</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-amber-300" />
              Task Activity
            </CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskActivityChart data={dashboard.taskActivity} />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartPie className="size-4 text-zinc-300" />
              Task Distribution
            </CardTitle>
            <CardDescription>Visible tasks by status</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskDistributionChart data={dashboard.taskDistribution} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <WorkspaceRecentTasksCard tasks={dashboard.recentTasks} />

        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader>
            <CardTitle>Team Spaces</CardTitle>
            <CardDescription>{dashboard.teamSpaces.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.teamSpaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are not in any team spaces yet.</p>
            ) : (
              <div className="max-h-[330px] space-y-4 overflow-y-auto pr-1">
                {dashboard.teamSpaces.map((space) => (
                  <Link
                    key={space.id}
                    href={`/workspace/team-space/${space.id}`}
                    className="block rounded-lg border border-border/60 bg-background/30 p-3 shadow-[inset_0_1px_0_hsl(var(--border)/0.2)] transition-colors hover:bg-background/50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{space.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {space.memberCount} members • {space.projectCount} projects • {space.taskCount} tasks
                        </p>
                      </div>
                      <Badge>{space.completionRate}%</Badge>
                    </div>

                    <div className="space-y-2">
                      {space.projects.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No recent projects.</p>
                      ) : (
                        space.projects.map((project) => (
                          <div key={project.id}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="truncate text-muted-foreground">{project.name}</span>
                              <span>{project.completionRate}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-zinc-300"
                                style={{ width: `${project.completionRate}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dashboard.kpis.totalTasks === 0 && (
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" />
            No visible tasks yet. Create a project and add tasks to start tracking activity.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
