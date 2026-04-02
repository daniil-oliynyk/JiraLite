import Link from "next/link";
import { ReactNode } from "react";

import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TeamSpaceLink = {
  id: string;
  name: string;
};

type WorkspaceShellProps = {
  userEmail: string;
  teamSpaces: TeamSpaceLink[];
  children: ReactNode;
};

export function WorkspaceShell({ userEmail, teamSpaces, children }: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Kinetic Workspace</h1>
            <p className="text-xs text-muted-foreground">Dark-mode project operations</p>
          </div>
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit">
              Sign Out
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit border-border/70 bg-card/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</p>
          <p className="mt-1 truncate text-sm font-semibold">{userEmail}</p>
          <nav className="mt-6 space-y-2">
            <Link className="block rounded-md bg-muted/60 px-3 py-2 text-sm" href="/workspace">
              Dashboard
            </Link>
            {teamSpaces.map((space) => (
              <Link
                key={space.id}
                className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                href={`/workspace/team-space/${space.id}`}
              >
                {space.name}
              </Link>
            ))}
          </nav>
        </Card>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
