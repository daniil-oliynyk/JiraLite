"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { deleteProjectAction, updateProjectAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectCardActionsMenuProps = {
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  teamSpaceId: string;
  teamMembers: { id: string; email: string }[];
  currentMemberUserIds: string[];
};

export function ProjectCardActionsMenu({
  projectId,
  projectName,
  projectDescription,
  teamSpaceId,
  teamMembers,
  currentMemberUserIds,
}: ProjectCardActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const [descriptionDraft, setDescriptionDraft] = useState(projectDescription ?? "");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberUserIds, setSelectedMemberUserIds] = useState<string[]>(currentMemberUserIds);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const filteredMembers = useMemo(
    () => teamMembers.filter((member) => member.email.toLowerCase().includes(memberSearch.toLowerCase())),
    [memberSearch, teamMembers],
  );

  function openEditProjectDialog() {
    setNameDraft(projectName);
    setDescriptionDraft(projectDescription ?? "");
    setSelectedMemberUserIds(currentMemberUserIds);
    setMemberSearch("");
    setOpen(false);
    setShowEditDialog(true);
  }

  function openDeleteProjectDialog() {
    setDeleteConfirmationName("");
    setOpen(false);
    setShowDeleteDialog(true);
  }

  function toggleMember(userId: string) {
    setSelectedMemberUserIds((previous) =>
      previous.includes(userId) ? previous.filter((value) => value !== userId) : [...previous, userId],
    );
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className="relative z-30 pointer-events-auto" ref={menuRef} onClick={(event) => event.stopPropagation()}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Project actions for ${projectName}`}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="size-4" />
        </button>

        {open ? (
          <div className="absolute right-0 top-7 z-40 min-w-32 rounded-md border border-border bg-popover p-1 shadow-md">
            <button
              type="button"
              onClick={openEditProjectDialog}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Edit project
            </button>
            <button
              type="button"
              onClick={openDeleteProjectDialog}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-accent"
            >
              Delete project
            </button>
          </div>
        ) : null}
      </div>

      {showEditDialog ? (
        <DialogContent
          onClose={() => {
            setShowEditDialog(false);
            setMemberSearch("");
          }}
          className="max-w-xl"
        >
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details and manage access for team members.</DialogDescription>
          </DialogHeader>

          <form
            action={async (formData) => {
              await updateProjectAction(formData);
              setShowEditDialog(false);
              setOpen(false);
              router.refresh();
            }}
            className="space-y-4"
          >
            <input type="hidden" name="projectId" value={projectId} />

            <div className="space-y-2">
              <Label htmlFor={`edit-project-name-${projectId}`}>Title</Label>
              <Input
                id={`edit-project-name-${projectId}`}
                name="name"
                required
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`edit-project-description-${projectId}`}>Description</Label>
              <Textarea
                id={`edit-project-description-${projectId}`}
                name="description"
                rows={3}
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Members</Label>
              <Input
                placeholder="Search team members..."
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
              />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/70 p-1">
                {filteredMembers.map((member) => {
                  const selected = selectedMemberUserIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                        selected ? "bg-accent/70" : ""
                      }`}
                    >
                      <span className="truncate">{member.email}</span>
                      {selected ? <span className="text-xs text-muted-foreground">Selected</span> : null}
                    </button>
                  );
                })}
                {filteredMembers.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No members found.</p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Only team-space members can be selected. You remain included automatically as manager.
              </p>
            </div>

            {selectedMemberUserIds.map((memberUserId) => (
              <input key={memberUserId} type="hidden" name="memberUserIds" value={memberUserId} />
            ))}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowEditDialog(false);
                  setMemberSearch("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-slate-200 text-slate-900 hover:bg-slate-100">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}

      {showDeleteDialog ? (
        <DialogContent onClose={() => setShowDeleteDialog(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type <span className="font-medium text-foreground">{projectName}</span> to
              confirm deletion.
            </DialogDescription>
          </DialogHeader>

          <form
            action={async (formData) => {
              await deleteProjectAction(formData);
              setShowDeleteDialog(false);
              setOpen(false);
              router.refresh();
            }}
            className="space-y-4"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="teamSpaceId" value={teamSpaceId} />

            <div className="space-y-2">
              <Label htmlFor={`delete-project-name-${projectId}`}>Project name</Label>
              <Input
                id={`delete-project-name-${projectId}`}
                name="confirmationName"
                value={deleteConfirmationName}
                onChange={(event) => setDeleteConfirmationName(event.target.value)}
                placeholder={projectName}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteConfirmationName !== projectName}>
                Confirm Delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </>
  );
}
