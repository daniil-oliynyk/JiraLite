"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type TeamSpaceCreateProjectButtonProps = {
  teamSpaceId: string;
};

export function TeamSpaceCreateProjectButton({ teamSpaceId }: TeamSpaceCreateProjectButtonProps) {
  const handleOpenCreateProject = () => {
    window.dispatchEvent(
      new CustomEvent("workspace:open-create-project", {
        detail: { teamSpaceId },
      }),
    );
  };

  return (
    <Button type="button" size="sm" onClick={handleOpenCreateProject} className="gap-1.5 bg-slate-200 text-slate-900 hover:bg-slate-100">
      <Plus className="size-3.5" />
      Create Project
    </Button>
  );
}
