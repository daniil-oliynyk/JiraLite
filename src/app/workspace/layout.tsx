import { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/auth";
import { getWorkspaceSidebarData } from "@/lib/queries";
import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const teamSpaces = await getWorkspaceSidebarData(user.id);

  return (
    <SidebarProvider>
      <AppSidebar teamSpaces={teamSpaces} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground truncate">{user.email}</span>
          <div className="ml-auto">
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </header>
        <div className="flex-1 p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
