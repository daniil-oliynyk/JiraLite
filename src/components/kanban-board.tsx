"use client";

import {
  closestCenter,
  DragCancelEvent,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { CommentType, TaskPriority, TaskStatus } from "@prisma/client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Calendar, CheckCircle2, ChevronDown, Clock3, Flag, GripVertical, LayoutGrid, List, Plus, Search, Send, UserCircle2 } from "lucide-react";

import { createTaskAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/lib/constants";
import { cn, formatDurationFromMinutes } from "@/lib/utils";

type TaskCard = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimationMinutes: number | null;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeEmail: string | null;
  comments: TaskComment[];
};

type TaskComment = {
  id: string;
  type: CommentType;
  content: string;
  createdAt: string;
  userEmail: string;
};

type KanbanBoardProps = {
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  tasks: TaskCard[];
  assignees: { id: string; email: string }[];
};

type DragData = {
  type: "column" | "task";
  status?: TaskStatus;
};

const PRIORITY_OPTIONS: TaskPriority[] = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PriorityPill({ priority }: { priority: TaskPriority }) {
  const tone =
    priority === TaskPriority.LOW
      ? "bg-slate-700/50 text-sky-300"
      : priority === TaskPriority.MEDIUM
        ? "bg-sky-600/20 text-sky-300"
        : priority === TaskPriority.HIGH
          ? "bg-rose-600/20 text-rose-300"
          : "bg-red-600/20 text-red-300";

  return <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium", tone)}>{priority}</span>;
}

function TaskCardPreview({ task }: { task: TaskCard }) {
  const isDone = task.status === TaskStatus.DONE;

  return (
    <article
      className={cn(
        "rounded-md border border-[#1a2434] bg-[#070f1c] p-3 text-sm shadow-sm",
        isDone && "border-slate-600 bg-slate-900/70 ring-1 ring-inset ring-slate-600/60",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <PriorityPill priority={task.priority} />
        {isDone && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
            <CheckCircle2 className="size-3" />
            Completed
          </span>
        )}
      </div>
      <p className={cn("text-[13px] text-slate-100", isDone && "text-slate-400 line-through")}>{task.title}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatDurationFromMinutes(task.estimationMinutes)}
        </span>
        {task.assigneeEmail && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-700/30 text-[10px] font-medium text-sky-300">
            {task.assigneeEmail.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </article>
  );
}

function TaskDetailsDialog({
  open,
  onClose,
  projectId,
  task,
  assignees,
  onDescriptionSaved,
  onAssigneeSaved,
  onTaskDetailsSaved,
  onCommentAdded,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  task: TaskCard | null;
  assignees: { id: string; email: string }[];
  onDescriptionSaved: (taskId: string, description: string | null, activity: TaskComment | null) => void;
  onAssigneeSaved: (
    taskId: string,
    assigneeId: string | null,
    assigneeEmail: string | null,
    activity: TaskComment | null,
  ) => void;
  onTaskDetailsSaved: (
    taskId: string,
    updates: Partial<Pick<TaskCard, "priority" | "estimationMinutes" | "dueDate">>,
    activity: TaskComment | null,
  ) => void;
  onCommentAdded: (taskId: string, comment: TaskComment) => void;
}) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [showPriorityPopover, setShowPriorityPopover] = useState(false);
  const [estimationDraft, setEstimationDraft] = useState("");
  const [isEditingEstimation, setIsEditingEstimation] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [showDueDatePopover, setShowDueDatePopover] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingEstimation, setSavingEstimation] = useState(false);
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const assigneePopoverButtonRef = useRef<HTMLButtonElement | null>(null);
  const assigneePopoverRef = useRef<HTMLDivElement | null>(null);
  const priorityPopoverButtonRef = useRef<HTMLButtonElement | null>(null);
  const priorityPopoverRef = useRef<HTMLDivElement | null>(null);
  const dueDatePopoverButtonRef = useRef<HTMLButtonElement | null>(null);
  const dueDatePopoverRef = useRef<HTMLDivElement | null>(null);

  const filteredAssignees = assignees.filter((assignee) =>
    assignee.email.toLowerCase().includes(assigneeSearch.toLowerCase()),
  );

  useEffect(() => {
    if (!task) {
      return;
    }

    setDescriptionDraft(task.description ?? "");
    setIsEditingDescription(Boolean(task.description));
    setAssigneeDraft(task.assigneeId ?? "");
    setPriorityDraft(task.priority);
    setEstimationDraft(task.estimationMinutes !== null ? formatDurationFromMinutes(task.estimationMinutes) : "");
    setIsEditingEstimation(false);
    setDueDateDraft(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setCommentDraft("");
    setAssigneeSearch("");
    setShowAssigneePopover(false);
    setShowPriorityPopover(false);
    setShowDueDatePopover(false);
  }, [task?.id, task?.description, task?.assigneeId, task?.priority, task?.estimationMinutes, task?.dueDate, open]);

  useEffect(() => {
    if (!showAssigneePopover) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        assigneePopoverRef.current &&
        !assigneePopoverRef.current.contains(target) &&
        !assigneePopoverButtonRef.current?.contains(target)
      ) {
        setShowAssigneePopover(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowAssigneePopover(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAssigneePopover]);

  useEffect(() => {
    if (!showPriorityPopover) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        priorityPopoverRef.current &&
        !priorityPopoverRef.current.contains(target) &&
        !priorityPopoverButtonRef.current?.contains(target)
      ) {
        setShowPriorityPopover(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowPriorityPopover(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPriorityPopover]);

  useEffect(() => {
    if (!showDueDatePopover) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        dueDatePopoverRef.current &&
        !dueDatePopoverRef.current.contains(target) &&
        !dueDatePopoverButtonRef.current?.contains(target)
      ) {
        setShowDueDatePopover(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowDueDatePopover(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDueDatePopover]);

  if (!open || !task) {
    return null;
  }

  const currentTask = task;

  async function saveAssignee(nextAssigneeId: string) {
    const currentAssigneeId = currentTask.assigneeId ?? "";
    if (nextAssigneeId === currentAssigneeId) {
      setShowAssigneePopover(false);
      setAssigneeSearch("");
      return;
    }

    setSavingAssignee(true);
    try {
      const response = await fetch(`/api/tasks/${currentTask.id}/assignee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assigneeId: nextAssigneeId || null,
        }),
      });

      if (!response.ok) {
        setAssigneeDraft(currentAssigneeId);
        return;
      }

      const payload = (await response.json()) as {
        assigneeId: string | null;
        assigneeEmail: string | null;
        activity: TaskComment | null;
      };

      onAssigneeSaved(currentTask.id, payload.assigneeId, payload.assigneeEmail, payload.activity ?? null);
      setAssigneeDraft(payload.assigneeId ?? "");
      setShowAssigneePopover(false);
      setAssigneeSearch("");
    } finally {
      setSavingAssignee(false);
    }
  }

  const selectedAssigneeLabel =
    assigneeDraft.length > 0
      ? assignees.find((assignee) => assignee.id === assigneeDraft)?.email ?? currentTask.assigneeEmail ?? "Unknown"
      : "Unassigned";

  async function saveTaskDetails(updates: {
    priority?: TaskPriority;
    estimation?: string;
    dueDate?: string | null;
  }) {
    const response = await fetch(`/api/tasks/${currentTask.id}/details`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...updates }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as {
      priority: TaskPriority;
      estimationMinutes: number | null;
      dueDate: string | null;
      activity: TaskComment | null;
    };
  }

  async function savePriority(nextPriority: TaskPriority) {
    if (nextPriority === currentTask.priority) {
      setShowPriorityPopover(false);
      return;
    }

    setSavingPriority(true);
    try {
      const payload = await saveTaskDetails({ priority: nextPriority });
      if (!payload) {
        setPriorityDraft(currentTask.priority);
        return;
      }

      setPriorityDraft(payload.priority);
      onTaskDetailsSaved(currentTask.id, { priority: payload.priority }, payload.activity ?? null);
      setShowPriorityPopover(false);
    } finally {
      setSavingPriority(false);
    }
  }

  async function saveEstimation() {
    const trimmed = estimationDraft.trim();
    const current = currentTask.estimationMinutes !== null ? formatDurationFromMinutes(currentTask.estimationMinutes) : "";
    if (trimmed === current) {
      setIsEditingEstimation(false);
      return;
    }

    setSavingEstimation(true);
    try {
      const payload = await saveTaskDetails({ estimation: trimmed });
      if (!payload) {
        setEstimationDraft(current);
        return;
      }

      setEstimationDraft(payload.estimationMinutes !== null ? formatDurationFromMinutes(payload.estimationMinutes) : "");
      onTaskDetailsSaved(currentTask.id, { estimationMinutes: payload.estimationMinutes }, payload.activity ?? null);
      setIsEditingEstimation(false);
    } finally {
      setSavingEstimation(false);
    }
  }

  async function saveDueDate(nextDueDate: string) {
    const next = nextDueDate || "";
    const current = currentTask.dueDate ? currentTask.dueDate.slice(0, 10) : "";
    if (next === current) {
      setShowDueDatePopover(false);
      return;
    }

    setSavingDueDate(true);
    try {
      const payload = await saveTaskDetails({ dueDate: next || null });
      if (!payload) {
        setDueDateDraft(current);
        return;
      }

      setDueDateDraft(payload.dueDate ? payload.dueDate.slice(0, 10) : "");
      onTaskDetailsSaved(currentTask.id, { dueDate: payload.dueDate }, payload.activity ?? null);
      setShowDueDatePopover(false);
    } finally {
      setSavingDueDate(false);
    }
  }

  async function saveDescription() {
    const trimmed = descriptionDraft.trim();
    const current = (currentTask.description ?? "").trim();

    if (!trimmed && !current) {
      setIsEditingDescription(false);
      return;
    }

    if (trimmed === current) {
      return;
    }

    setSavingDescription(true);
    try {
      const response = await fetch(`/api/tasks/${currentTask.id}/description`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, description: trimmed }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        description: string | null;
        activity: TaskComment | null;
      };

      onDescriptionSaved(currentTask.id, payload.description ?? null, payload.activity ?? null);
      if (!payload.description) {
        setIsEditingDescription(false);
      }
    } finally {
      setSavingDescription(false);
    }
  }

  async function submitComment() {
    const content = commentDraft.trim();
    if (!content) {
      return;
    }

    setSendingComment(true);
    try {
      const response = await fetch(`/api/tasks/${currentTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { comment: TaskComment };
      onCommentAdded(currentTask.id, payload.comment);
      setCommentDraft("");
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <DialogContent onClose={onClose} className="max-w-[1100px] border-[#172334] bg-[#020814] p-0 text-slate-100">
      <div className="grid max-h-[85svh] min-h-[70svh] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_340px]">
        <section className="overflow-y-auto p-6 lg:border-r lg:border-[#132134]">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Task</p>
              <h2 className="text-2xl font-semibold text-slate-100">{currentTask.title}</h2>
            </div>

            <div className="grid gap-4 rounded-md border border-[#132134] bg-[#060f1d] p-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <p className="inline-flex items-center gap-2 text-slate-400"><Flag className="size-3.5" /> Status</p>
                <p className="text-slate-200">{TASK_STATUS_LABELS[currentTask.status]}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="inline-flex items-center gap-2 text-slate-400"><Flag className="size-3.5" /> Priority</p>
                <div className="relative">
                  <button
                    ref={priorityPopoverButtonRef}
                    type="button"
                    disabled={savingPriority}
                    onClick={() => setShowPriorityPopover((prev) => !prev)}
                    className="inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left text-slate-200 transition-colors hover:bg-[#0b1728] hover:text-slate-100 disabled:opacity-60"
                  >
                    <span className="truncate border-transparent">{priorityDraft}</span>
                    <ChevronDown className="size-3.5 text-slate-400" />
                  </button>

                  {showPriorityPopover && (
                    <div
                      ref={priorityPopoverRef}
                      className="absolute left-0 top-9 z-30 w-52 rounded-md border border-[#1a2a3d] bg-[#060f1d] p-2 shadow-md"
                    >
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {PRIORITY_OPTIONS.map((priority) => (
                          <button
                            key={priority}
                            type="button"
                            onClick={() => {
                              setPriorityDraft(priority);
                              void savePriority(priority);
                            }}
                            className={cn(
                              "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-[#101b2c]",
                              priorityDraft === priority && "bg-[#101b2c]",
                            )}
                          >
                            {priority.charAt(0) + priority.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {savingPriority ? <p className="text-xs text-slate-500">Saving priority...</p> : null}
              </div>
              <div className="space-y-1 text-sm">
                <p className="inline-flex items-center gap-2 text-slate-400"><UserCircle2 className="size-3.5" /> Assignee</p>
                <div className="relative">
                  <button
                    ref={assigneePopoverButtonRef}
                    type="button"
                    disabled={savingAssignee}
                    onClick={() => setShowAssigneePopover((prev) => !prev)}
                    className="inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left text-slate-200 transition-colors hover:bg-[#0b1728] hover:text-slate-100 disabled:opacity-60"
                  >
                    <span className="truncate  border-transparent hover:border-slate-500">{selectedAssigneeLabel}</span>
                    <ChevronDown className="size-3.5 text-slate-400" />
                  </button>

                  {showAssigneePopover && (
                    <div
                      ref={assigneePopoverRef}
                      className="absolute left-0 top-9 z-30 w-72 rounded-md border border-[#1a2a3d] bg-[#060f1d] p-2 shadow-md"
                    >
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
                        <Input
                          value={assigneeSearch}
                          onChange={(event) => setAssigneeSearch(event.target.value)}
                          placeholder="Search assignees..."
                          className="h-9 border-[#132134] bg-[#040b16] pl-8 text-sm text-slate-100 placeholder:text-slate-500"
                        />
                      </div>

                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigneeDraft("");
                            void saveAssignee("");
                          }}
                          className={cn(
                            "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-[#101b2c]",
                            assigneeDraft === "" && "bg-[#101b2c]",
                          )}
                        >
                          Unassigned
                        </button>

                        {filteredAssignees.map((assignee) => (
                          <button
                            key={assignee.id}
                            type="button"
                            onClick={() => {
                              setAssigneeDraft(assignee.id);
                              void saveAssignee(assignee.id);
                            }}
                            className={cn(
                              "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-[#101b2c]",
                              assigneeDraft === assignee.id && "bg-[#101b2c]",
                            )}
                          >
                            <span className="truncate">{assignee.email}</span>
                          </button>
                        ))}

                        {filteredAssignees.length === 0 ? (
                          <p className="px-2 py-1.5 text-sm text-slate-500">No assignees found.</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
                {savingAssignee ? <p className="text-xs text-slate-500">Saving assignee...</p> : null}
              </div>
              <div className="space-y-1 text-sm">
                <p className="inline-flex items-center gap-2 text-slate-400"><Clock3 className="size-3.5" /> Estimation</p>
                {isEditingEstimation ? (
                  <Input
                    value={estimationDraft}
                    autoFocus
                    onChange={(event) => setEstimationDraft(event.target.value)}
                    onBlur={() => {
                      void saveEstimation();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveEstimation();
                      }
                      if (event.key === "Escape") {
                        setEstimationDraft(currentTask.estimationMinutes !== null ? formatDurationFromMinutes(currentTask.estimationMinutes) : "");
                        setIsEditingEstimation(false);
                      }
                    }}
                    placeholder="e.g. 2h"
                    className="h-8 border-[#132134] bg-[#040b16] text-sm text-slate-100 placeholder:text-slate-500"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={savingEstimation}
                    onClick={() => setIsEditingEstimation(true)}
                    className="h-8 w-full rounded px-1 py-0.5 text-left text-slate-200 transition-colors hover:bg-[#0b1728] hover:text-slate-100 disabled:opacity-60"
                  >
                    {formatDurationFromMinutes(currentTask.estimationMinutes)}
                  </button>
                )}
                {savingEstimation ? <p className="text-xs text-slate-500">Saving estimation...</p> : null}
              </div>
              <div className="space-y-1 text-sm sm:col-span-2">
                <p className="inline-flex items-center gap-2 text-slate-400"><Calendar className="size-3.5" /> Due Date</p>
                <div className="relative">
                  <button
                    ref={dueDatePopoverButtonRef}
                    type="button"
                    disabled={savingDueDate}
                    onClick={() => setShowDueDatePopover((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-slate-200 transition-colors hover:bg-[#0b1728] hover:text-slate-100 disabled:opacity-60"
                  >
                    <span>{currentTask.dueDate ? formatDateTimeLabel(currentTask.dueDate) : "No due date"}</span>
                    <ChevronDown className="size-3.5 text-slate-400" />
                  </button>

                  {showDueDatePopover && (
                    <div
                      ref={dueDatePopoverRef}
                      className="absolute left-0 top-9 z-30 w-64 rounded-md border border-[#1a2a3d] bg-[#060f1d] p-2 shadow-md"
                    >
                      <Input
                        type="date"
                        value={dueDateDraft}
                        onChange={(event) => {
                          const nextDate = event.target.value;
                          setDueDateDraft(nextDate);
                          void saveDueDate(nextDate);
                        }}
                        className="h-9 border-[#132134] bg-[#040b16] text-sm text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDueDateDraft("");
                          void saveDueDate("");
                        }}
                        className="mt-2 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Clear due date
                      </button>
                    </div>
                  )}
                </div>
                {savingDueDate ? <p className="text-xs text-slate-500">Saving due date...</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Description</p>

              {!isEditingDescription && !currentTask.description ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(true)}
                  className="rounded-md border border-dashed border-[#25344a] px-3 py-2 text-sm text-slate-400 hover:border-[#35506f] hover:text-slate-200"
                >
                  Add Description
                </button>
              ) : (
                <Textarea
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  onBlur={async () => {
                    await saveDescription();
                    if (!descriptionDraft.trim() && !(currentTask.description ?? "").trim()) {
                      setIsEditingDescription(false);
                    }
                  }}
                  placeholder="Add more details..."
                  className="min-h-[140px] border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
                />
              )}
              {savingDescription ? <p className="text-xs text-slate-500">Saving description...</p> : null}
            </div>
          </div>
        </section>

        <aside className="flex h-full min-h-0 flex-col border-t border-[#132134] bg-[#040b16] lg:border-t-0">
          <div className="border-b border-[#132134] px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">Activity</h3>
          </div>

          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-3">
            {currentTask.comments.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : (
              currentTask.comments.map((comment) => (
                comment.type === "ACTIVITY" ? (
                  <div key={comment.id} className="space-y-0.5 border-t border-[#132134]/60 pt-1 first:border-t-0 first:pt-0">
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      <span className="font-normal text-slate-400">{comment.userEmail}</span> {comment.content}
                    </p>
                    <p className="text-[10px] text-slate-600">{formatDateTimeLabel(comment.createdAt)}</p>
                  </div>
                ) : (
                  <div key={comment.id} className="rounded-md border border-[#152238] bg-[#06101e] p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{comment.userEmail}</span>
                      <span>{formatDateTimeLabel(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-200">{comment.content}</p>
                  </div>
                )
              ))
            )}
          </div>

          <div className="border-t border-[#132134] p-3">
            <div className="relative">
              <Textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Write a comment..."
                className="min-h-[88px] border-[#132134] bg-[#060f1d] pr-10 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                disabled={sendingComment || !commentDraft.trim()}
                onClick={submitComment}
                aria-label={sendingComment ? "Sending comment" : "Send comment"}
                className="absolute bottom-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#0b1728] hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </DialogContent>
  );
}

function SortableTaskCard({ task, onOpenTask }: { task: TaskCard; onOpenTask: (taskId: string) => void }) {
  const isDone = task.status === TaskStatus.DONE;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status } satisfies DragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      onClick={() => onOpenTask(task.id)}
      className={cn(
        "rounded-md border border-[#1a2434] bg-[#070f1c] p-3 text-sm shadow-sm",
        "transition-colors hover:border-[#2a3c58]",
        isDone && "border-slate-600 bg-slate-900/70 ring-1 ring-inset ring-slate-600/60",
        isDragging && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex size-5 items-center justify-center rounded text-slate-500 hover:bg-[#101b2c] hover:text-slate-300"
            aria-label="Drag task"
          >
            <GripVertical className="size-4.5" />
          </button>
          <PriorityPill priority={task.priority} />
        </div>
        {isDone && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
            <CheckCircle2 className="size-3" />
            Completed
          </span>
        )}
      </div>
      <p className={cn("text-[13px] text-slate-100", isDone && "text-slate-400 line-through")}>{task.title}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatDurationFromMinutes(task.estimationMinutes)}
        </span>
        {task.assigneeEmail && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-700/30 text-[10px] font-medium text-sky-300">
            {task.assigneeEmail.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </article>
  );
}

function SortableColumn({
  status,
  tasks,
  dimmed,
  onAddTask,
  onOpenTask,
}: {
  status: TaskStatus;
  tasks: TaskCard[];
  dimmed?: boolean;
  onAddTask: (status: TaskStatus) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status,
    data: { type: "column", status } satisfies DragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "h-[calc(100svh-13rem)] w-[500px] min-w-0 rounded-lg border border-[#111c2c] bg-[#040b16] p-3",
        dimmed && "opacity-80",
        isDragging && "opacity-50",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300" {...attributes} {...listeners}>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          <span>{TASK_STATUS_LABELS[status]}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{tasks.length}</span>
        </div>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-200"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onAddTask(status)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onOpenTask={onOpenTask} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function ColumnPreview({ status, tasks }: { status: TaskStatus; tasks: TaskCard[] }) {
  return (
    <section className="h-[calc(100svh-13rem)] w-full min-w-0 rounded-lg border border-[#111c2c] bg-[#040b16] p-3">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          <span>{TASK_STATUS_LABELS[status]}</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{tasks.length}</span>
        </div>
      </div>
    </section>
  );
}

function CreateTaskDialog({
  open,
  onClose,
  onSubmit,
  projectId,
  assignees,
  defaultStatus,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  projectId: string;
  assignees: { id: string; email: string }[];
  defaultStatus: TaskStatus;
  submitting: boolean;
}) {
  const [estimationHours, setEstimationHours] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <DialogContent
      onClose={onClose}
      className="max-w-2xl border-[#172334] bg-[#020814] p-6 text-slate-100 shadow-[0_12px_48px_rgba(0,0,0,0.55)]"
    >
      <form
        action={onSubmit}
        className="space-y-5"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="estimation" value={estimationHours ? `${estimationHours}h` : ""} />

        <DialogHeader className="space-y-1">
          <DialogTitle className="text-3xl font-semibold text-slate-100">Create Task</DialogTitle>
          <DialogDescription className="text-base text-slate-400">Add a new task to your project board.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="task-title" className="text-base font-medium text-slate-200">Title</Label>
          <Input
            id="task-title"
            name="title"
            placeholder="What needs to be done?"
            required
            className="h-11 border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-description" className="text-base font-medium text-slate-200">
            Description <span className="font-normal text-slate-500">(optional)</span>
          </Label>
          <Textarea
            id="task-description"
            name="description"
            placeholder="Add more details..."
            className="min-h-[112px] border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="task-status" className="text-base font-medium text-slate-200">Status</Label>
            <select
              id="task-status"
              name="status"
              defaultValue={defaultStatus}
              className="h-11 w-full rounded-md border border-[#132134] bg-[#060f1d] px-3 text-base text-slate-100 outline-none focus:border-[#274a72]"
            >
              {TASK_STATUS_ORDER.map((status) => (
                <option key={status} value={status} className="bg-[#060f1d] text-slate-100">
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-priority" className="text-base font-medium text-slate-200">Priority</Label>
            <select
              id="task-priority"
              name="priority"
              defaultValue={TaskPriority.MEDIUM}
              className="h-11 w-full rounded-md border border-[#132134] bg-[#060f1d] px-3 text-base text-slate-100 outline-none focus:border-[#274a72]"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority} className="bg-[#060f1d] text-slate-100">
                  {priority.charAt(0) + priority.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-assignee" className="text-base font-medium text-slate-200">Assignee</Label>
          <select
            id="task-assignee"
            name="assigneeId"
            defaultValue=""
            className="h-11 w-full rounded-md border border-[#132134] bg-[#060f1d] px-3 text-base text-slate-100 outline-none focus:border-[#274a72]"
          >
            <option value="" className="bg-[#060f1d] text-slate-400">
              Unassigned
            </option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id} className="bg-[#060f1d] text-slate-100">
                {assignee.email}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="task-due-date" className="text-base font-medium text-slate-200">Due Date <span className="font-normal text-slate-500">(optional)</span></Label>
            <Input
              id="task-due-date"
              name="dueDate"
              type="date"
              className="h-11 border-[#132134] bg-[#060f1d] text-base text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-estimation" className="text-base font-medium text-slate-200">Estimation (hours) <span className="font-normal text-slate-500">(optional)</span> </Label>
            <Input
              id="task-estimation"
              type="number"
              min={0}
              step={1}
              value={estimationHours}
              onChange={(event) => setEstimationHours(event.target.value)}
              placeholder="e.g., 8"
              className="h-11 border-[#132134] bg-[#060f1d] text-base text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-10 border border-[#1a2a3d] bg-[#070f1c] px-5 text-base text-slate-200 hover:bg-[#0c1627]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="h-10 bg-sky-600 px-5 text-base text-white hover:bg-sky-500"
          >
            {submitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export function KanbanBoard({ projectId, projectName, projectDescription, tasks: initialTasks, assignees }: KanbanBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [columnOrder, setColumnOrder] = useState<TaskStatus[]>(TASK_STATUS_ORDER);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<TaskStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [pending, startTransition] = useTransition();
  const [createPending, startCreateTransition] = useTransition();
  const dragStartTasksRef = useRef<TaskCard[] | null>(null);
  const activeTaskInitialStatusRef = useRef<TaskStatus | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(useSensor(PointerSensor));

  const grouped = useMemo(() => {
    return columnOrder.reduce<Record<TaskStatus, TaskCard[]>>((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {
      [TaskStatus.TODO]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.DONE]: [],
    });
  }, [tasks, columnOrder]);

  function persistStatusChange(taskId: string, status: TaskStatus, previousTasks: TaskCard[]) {
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, projectId }),
      });

      if (!response.ok) {
        setTasks(previousTasks);
        return;
      }

      const payload = (await response.json()) as { activity?: TaskComment | null };
      if (!payload.activity) {
        return;
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                comments: [payload.activity as TaskComment, ...task.comments],
              }
            : task,
        ),
      );
    });
  }

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined;
    if (data?.type === "task") {
      setActiveTaskId(String(event.active.id));
      dragStartTasksRef.current = tasks;
      activeTaskInitialStatusRef.current = tasks.find((task) => task.id === String(event.active.id))?.status ?? null;
      return;
    }
    if (data?.type === "column") {
      setActiveColumnId(event.active.id as TaskStatus);
    }
  }

  function onDragCancel(_event: DragCancelEvent) {
    if (dragStartTasksRef.current) {
      setTasks(dragStartTasksRef.current);
    }
    setActiveTaskId(null);
    setActiveColumnId(null);
    dragStartTasksRef.current = null;
    activeTaskInitialStatusRef.current = null;
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (activeData?.type !== "task") {
      return;
    }

    const overStatus = overData?.type === "column" ? overData.status : overData?.status;
    if (!overStatus) {
      return;
    }

    setTasks((prev) => {
      const activeIndex = prev.findIndex((task) => task.id === String(active.id));
      if (activeIndex === -1) {
        return prev;
      }

      const next = [...prev];
      next[activeIndex] = { ...next[activeIndex], status: overStatus };

      if (overData?.type === "task") {
        const overIndex = prev.findIndex((task) => task.id === String(over.id));
        if (overIndex !== -1 && overIndex !== activeIndex) {
          return arrayMove(next, activeIndex, overIndex);
        }
      }

      return next;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveTaskId(null);
    setActiveColumnId(null);

    if (!over) {
      if (dragStartTasksRef.current) {
        setTasks(dragStartTasksRef.current);
      }
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    const activeData = active.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    if (activeData?.type === "column" && overData?.type === "column") {
      const oldIndex = columnOrder.indexOf(active.id as TaskStatus);
      const newIndex = columnOrder.indexOf(over.id as TaskStatus);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setColumnOrder((prev) => arrayMove(prev, oldIndex, newIndex));
      }
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    if (activeData?.type !== "task") {
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    const taskId = String(active.id);
    const droppedStatus =
      overData?.type === "column"
        ? overData.status
        : overData?.type === "task"
          ? overData.status
          : undefined;

    if (!droppedStatus) {
      dragStartTasksRef.current = null;
      activeTaskInitialStatusRef.current = null;
      return;
    }

    setTasks((prev) => {
      const taskIndex = prev.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) {
        return prev;
      }

      const next = [...prev];
      next[taskIndex] = { ...next[taskIndex], status: droppedStatus };
      return next;
    });

    const initialStatus = activeTaskInitialStatusRef.current;
    if (initialStatus && droppedStatus !== initialStatus) {
      persistStatusChange(taskId, droppedStatus, dragStartTasksRef.current ?? tasks);
    }

    dragStartTasksRef.current = null;
    activeTaskInitialStatusRef.current = null;
  }

  const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null;
  const activeColumn = activeColumnId ?? null;
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;

  function applyTaskUpdate(taskId: string, updater: (task: TaskCard) => TaskCard) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
  }

  function openCreateTask(status: TaskStatus) {
    setCreateTaskStatus(status);
    setCreateTaskOpen(true);
  }

  function submitCreateTask(formData: FormData) {
    startCreateTransition(async () => {
      await createTaskAction(formData);
      setCreateTaskOpen(false);
      router.refresh();
    });
  }

  function openTask(taskId: string) {
    setSelectedTaskId(taskId);
  }

  return (
    <div className="space-y-4 rounded-xl border border-[#0e1827] bg-[#020814] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{projectName}</h1>
          <p className="text-sm text-slate-400">{projectDescription || "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="gap-1.5 bg-[#0d1726] text-slate-100 hover:bg-[#132238]">
            <LayoutGrid className="size-3.5" />
            Board
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-slate-300 hover:text-slate-100">
            <List className="size-3.5" />
            List
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-sky-600 hover:bg-sky-500"
            onClick={() => openCreateTask(TaskStatus.TODO)}
          >
            <Plus className="size-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
          <div className={cn("flex gap-3 overflow-x-auto pb-2", pending && "opacity-85")}>
            {columnOrder.map((status) => (
              <SortableColumn
                key={status}
                status={status}
                tasks={grouped[status]}
                dimmed={pending}
                onAddTask={openCreateTask}
                onOpenTask={openTask}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeTask ? <TaskCardPreview task={activeTask} /> : null}
          {!activeTask && activeColumn ? <ColumnPreview status={activeColumn} tasks={grouped[activeColumn]} /> : null}
        </DragOverlay>
      </DndContext>

      <CreateTaskDialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={submitCreateTask}
        projectId={projectId}
        assignees={assignees}
        defaultStatus={createTaskStatus}
        submitting={createPending}
      />

      <TaskDetailsDialog
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTaskId(null)}
        projectId={projectId}
        task={selectedTask}
        assignees={assignees}
        onDescriptionSaved={(taskId, description, activity) => {
          applyTaskUpdate(taskId, (task) => ({
            ...task,
            description,
            comments: activity ? [activity, ...task.comments] : task.comments,
          }));
        }}
        onAssigneeSaved={(taskId, assigneeId, assigneeEmail, activity) => {
          applyTaskUpdate(taskId, (task) => ({
            ...task,
            assigneeId,
            assigneeEmail,
            comments: activity ? [activity, ...task.comments] : task.comments,
          }));
        }}
        onTaskDetailsSaved={(taskId, updates, activity) => {
          applyTaskUpdate(taskId, (task) => ({
            ...task,
            ...updates,
            comments: activity ? [activity, ...task.comments] : task.comments,
          }));
        }}
        onCommentAdded={(taskId, comment) => {
          applyTaskUpdate(taskId, (task) => ({ ...task, comments: [comment, ...task.comments] }));
        }}
      />
    </div>
  );
}
