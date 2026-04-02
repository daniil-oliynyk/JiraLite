import { ReactNode } from "react";

import { requireUser } from "@/lib/auth";
import { getWorkspaceSidebarData } from "@/lib/queries";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const teamSpaces = await getWorkspaceSidebarData(user.id);

  return (
    <WorkspaceShell userEmail={user.email} teamSpaces={teamSpaces}>
      {children}
    </WorkspaceShell>
  );
}
