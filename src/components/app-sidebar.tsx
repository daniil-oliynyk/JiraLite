"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, Lock, Plus, Search, UsersRound } from "lucide-react";

import { createProjectAction, createTeamSpaceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type Project = {
  id: string;
  name: string;
  visibility: string;
};

type TeamSpace = {
  id: string;
  name: string;
  projects: Project[];
  members: {
    id: string;
    email: string;
  }[];
};

export function AppSidebar({ teamSpaces }: { teamSpaces: TeamSpace[] }) {
  const pathname = usePathname();
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [actionMenuSpaceId, setActionMenuSpaceId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectTeamSpaceId, setProjectTeamSpaceId] = useState("");
  const [teamSpaceSearch, setTeamSpaceSearch] = useState("");
  const [showTeamSpaceDropdown, setShowTeamSpaceDropdown] = useState(false);
  const [makeProjectPrivate, setMakeProjectPrivate] = useState(false);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [sharedUserIds, setSharedUserIds] = useState<string[]>([]);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuPopoverRef = useRef<HTMLDivElement | null>(null);
  const sharePopoverButtonRef = useRef<HTMLButtonElement | null>(null);
  const sharePopoverRef = useRef<HTMLDivElement | null>(null);

  const selectedProjectSpace = teamSpaces.find((space) => space.id === projectTeamSpaceId);
  const filteredTeamSpaces = teamSpaces.filter((space) =>
    space.name.toLowerCase().includes(teamSpaceSearch.toLowerCase()),
  );
  const availableMembers = selectedProjectSpace?.members ?? [];
  const filteredMembers = availableMembers.filter((member) =>
    member.email.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        actionMenuSpaceId &&
        actionMenuPopoverRef.current &&
        !actionMenuPopoverRef.current.contains(target) &&
        !actionMenuButtonRef.current?.contains(target)
      ) {
        setActionMenuSpaceId(null);
      }

      if (
        showSharePopover &&
        sharePopoverRef.current &&
        !sharePopoverRef.current.contains(target) &&
        !sharePopoverButtonRef.current?.contains(target)
      ) {
        setShowSharePopover(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (actionMenuSpaceId) {
        setActionMenuSpaceId(null);
      }

      if (showSharePopover) {
        setShowSharePopover(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenuSpaceId, showSharePopover]);

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/workspace"}>
                <Link href="/workspace">
                  <LayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <div className="flex items-center justify-between">
              <SidebarGroupLabel>Team Spaces</SidebarGroupLabel>
              <button
                onClick={() => setShowCreateSpace(true)}
                className="mr-2 flex size-5 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {teamSpaces.map((space) => {
                  const spaceHref = `/workspace/team-space/${space.id}`;
                  const isSpaceActive = pathname.startsWith(spaceHref);

                  return (
                    <Collapsible key={space.id} defaultOpen={isSpaceActive} className="group/collapsible">
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isSpaceActive && !pathname.includes("/project/")} className="pr-8">
                          <div className="flex w-full items-center gap-2">
                            <div className="relative size-4 shrink-0">
                              <UsersRound className="absolute inset-0 size-4 transition-opacity duration-150 group-hover/menu-item:opacity-0" />
                              <CollapsibleTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Toggle ${space.name}`}
                                  className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/menu-item:opacity-100 pointer-events-none group-hover/menu-item:pointer-events-auto"
                                >
                                  <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                                </button>
                              </CollapsibleTrigger>
                            </div>
                            <span>{space.name}</span>
                          </div>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                          ref={actionMenuSpaceId === space.id ? actionMenuButtonRef : undefined}
                          aria-label={`Team Space actions for ${space.name}`}
                          onClick={() =>
                            setActionMenuSpaceId((prev) => (prev === space.id ? null : space.id))
                          }
                        >
                          <Plus className="size-3.5" />
                        </SidebarMenuAction>
                        {actionMenuSpaceId === space.id && (
                          <div
                            ref={actionMenuPopoverRef}
                            className="absolute right-2 top-8 z-20 min-w-40 rounded-md border border-border bg-popover p-1 shadow-md"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuSpaceId(null);
                                setProjectTeamSpaceId(space.id);
                                setTeamSpaceSearch("");
                                setShowTeamSpaceDropdown(false);
                                setMakeProjectPrivate(false);
                                setShowSharePopover(false);
                                setMemberSearch("");
                                setSharedUserIds([]);
                                setShowCreateProject(true);
                              }}
                              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              Create Project
                            </button>
                          </div>
                        )}
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {space.projects.map((project) => {
                              const projectHref = `/workspace/team-space/${space.id}/project/${project.id}`;
                              const isProjectActive = pathname === projectHref;
                              const isPrivate = project.visibility === "MEMBERS_ONLY";

                              return (
                                <SidebarMenuSubItem key={project.id}>
                                  <SidebarMenuSubButton asChild isActive={isProjectActive}>
                                    <Link href={projectHref as Route}>
                                      <span>{project.name}</span>
                                      {isPrivate && <Lock className="ml-auto size-3 text-sidebar-foreground/40" />}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                            {space.projects.length === 0 && (
                              <SidebarMenuSubItem>
                                <span className="px-2 py-1 text-xs text-sidebar-foreground/50">No projects</span>
                              </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
                {teamSpaces.length === 0 && (
                  <SidebarMenuItem>
                    <span className="px-2 py-1 text-xs text-sidebar-foreground/50">No spaces yet</span>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {showCreateSpace && (
        <DialogContent onClose={() => setShowCreateSpace(false)}>
          <DialogHeader>
            <DialogTitle>New Team Space</DialogTitle>
            <DialogDescription>Create a new team space to organize your projects.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await createTeamSpaceAction(formData);
              setShowCreateSpace(false);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="space-name">Name</Label>
              <Input id="space-name" name="name" required placeholder="Engineering" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="space-description">Description (optional)</Label>
              <Textarea id="space-description" name="description" placeholder="What is this space for?" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateSpace(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Space</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}

      {showCreateProject && (
        <DialogContent
          onClose={() => {
            setShowCreateProject(false);
            setShowTeamSpaceDropdown(false);
            setShowSharePopover(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Create a new project in a team space.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              formData.set("makePrivate", makeProjectPrivate ? "on" : "off");
              await createProjectAction(formData);
              setShowCreateProject(false);
              setShowTeamSpaceDropdown(false);
              setShowSharePopover(false);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" name="name" required placeholder="Platform Core" autoFocus />
            </div>

            <div className="space-y-2">
              <Label>Team Space</Label>
              <input type="hidden" name="teamSpaceId" value={projectTeamSpaceId} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTeamSpaceDropdown((prev) => !prev)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate">{selectedProjectSpace?.name ?? "Select Team Space"}</span>
                  <ChevronDown className="size-4 opacity-70" />
                </button>

                {showTeamSpaceDropdown && (
                  <div className="absolute left-0 right-0 top-11 z-30 rounded-md border border-border bg-popover p-2 shadow-md">
                    <Input
                      placeholder="Search team spaces..."
                      value={teamSpaceSearch}
                      onChange={(event) => setTeamSpaceSearch(event.target.value)}
                    />
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      {filteredTeamSpaces.map((space) => (
                        <button
                          key={space.id}
                          type="button"
                          onClick={() => {
                            setProjectTeamSpaceId(space.id);
                            setShowTeamSpaceDropdown(false);
                            setShowSharePopover(false);
                            setMemberSearch("");
                            setSharedUserIds([]);
                          }}
                          className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        >
                          {space.name}
                        </button>
                      ))}
                      {filteredTeamSpaces.length === 0 && (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">No team spaces found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between rounded-md border border-border/60 bg-background/40 p-3">
              <div>
                <p className="text-sm font-medium">Make Private</p>
                <p className="text-xs text-muted-foreground">Only invited members will have access</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={makeProjectPrivate}
                onClick={() =>
                  setMakeProjectPrivate((prev) => {
                    const next = !prev;
                    if (!next) {
                      setShowSharePopover(false);
                      setMemberSearch("");
                    }
                    return next;
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  makeProjectPrivate ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    makeProjectPrivate ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {makeProjectPrivate && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Share with</Label>
                  <div className="relative">
                    <button
                      ref={sharePopoverButtonRef}
                      type="button"
                      onClick={() => setShowSharePopover((prev) => !prev)}
                      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                    >
                      <Search className="size-4" />
                    </button>
                    {showSharePopover && (
                      <div
                        ref={sharePopoverRef}
                        className="absolute right-0 top-10 z-30 w-72 rounded-md border border-border bg-popover p-2 shadow-md"
                      >
                        <Input
                          placeholder="Search members..."
                          value={memberSearch}
                          onChange={(event) => setMemberSearch(event.target.value)}
                        />
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                          {filteredMembers.map((member) => {
                            const isSelected = sharedUserIds.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => {
                                  setSharedUserIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id],
                                  );
                                }}
                                className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                                  isSelected ? "bg-accent/70" : ""
                                }`}
                              >
                                <span className="truncate">{member.email}</span>
                                {isSelected && <span className="text-xs text-muted-foreground">Selected</span>}
                              </button>
                            );
                          })}
                          {filteredMembers.length === 0 && (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">No members found.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {sharedUserIds.length === 0 && (
                    <p className="text-xs text-muted-foreground">No members selected yet.</p>
                  )}
                  {sharedUserIds.map((userId) => {
                    const member = availableMembers.find((item) => item.id === userId);
                    if (!member) return null;
                    return (
                      <span
                        key={userId}
                        className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs"
                      >
                        {member.email}
                      </span>
                    );
                  })}
                </div>

                {sharedUserIds.map((userId) => (
                  <input key={userId} type="hidden" name="shareUserIds" value={userId} />
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreateProject(false);
                  setShowTeamSpaceDropdown(false);
                  setShowSharePopover(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!projectTeamSpaceId}>Create Project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </>
  );
}
